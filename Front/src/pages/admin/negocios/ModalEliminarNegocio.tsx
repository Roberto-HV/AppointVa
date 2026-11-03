import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PowerOff } from "lucide-react";
import { adminApi, type ImpactoEliminacionDto, type NegocioMetricasDto } from "../../../api/admin";
import Modal from "../../../components/ui/Modal";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import ErrorCarga from "../../../components/ui/ErrorCarga";
import { Skeleton } from "../../../components/ui/Skeleton";
import { useToastStore } from "../../../store/toastStore";
import { esCancelacion } from "../../../lib/pruebaReautenticacion";
import { mensajeError } from "../../../utils/errores";
import { useReautenticacion } from "./useReautenticacion";
import { BOTON_PIE, BOTON_PIE_SECUNDARIO, CAMPO_MODAL, CAMPO_OK } from "./estilos";

/**
 * Eliminar un negocio (lote 5, I3). Un solo paso con cifras concretas de lo que
 * se pierde, "Desactivar en su lugar" como opción recomendada y el nombre
 * escrito para confirmar (sin importar mayúsculas). Después se pide la
 * reautenticación (G1). El contenido se monta al abrir: siempre empieza en blanco.
 */
export default function ModalEliminarNegocio({
  negocio,
  abierto,
  onCerrar,
  onEliminado,
  onDesactivar,
}: {
  negocio: NegocioMetricasDto | null;
  abierto: boolean;
  onCerrar: () => void;
  /** Después de borrar (la ficha vuelve a la lista: el negocio ya no existe). */
  onEliminado?: (id: string) => void;
  /** "Desactivar en su lugar": cierra este modal y abre la confirmación de desactivar. */
  onDesactivar: (negocio: NegocioMetricasDto) => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Eliminar negocio" ancho="md">
      {negocio && (
        <ContenidoEliminar negocio={negocio} onCerrar={onCerrar} onEliminado={onEliminado} onDesactivar={onDesactivar} />
      )}
    </Modal>
  );
}

/** Mismo criterio que la búsqueda: sin distinguir mayúsculas ni espacios de más. */
const normalizar = (texto: string) => texto.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-MX");

const cantidad = (n: number, singular: string, plural: string) =>
  `${n.toLocaleString("es-MX")} ${n === 1 ? singular : plural}`;

function filasImpacto(i: ImpactoEliminacionDto): { texto: string; alerta?: boolean }[] {
  return [
    { texto: cantidad(i.citasProximas, "cita próxima", "citas próximas"), alerta: i.citasProximas > 0 },
    { texto: cantidad(i.citasPasadas, "cita en el historial", "citas en el historial") },
    { texto: cantidad(i.clientes, "cliente", "clientes") },
    { texto: `${cantidad(i.empleados, "empleado", "empleados")} y ${cantidad(i.servicios, "servicio", "servicios")}` },
    { texto: cantidad(i.pagos, "pago de suscripción registrado", "pagos de suscripción registrados") },
    { texto: `${cantidad(i.imagenes, "imagen", "imágenes")} y ${cantidad(i.resenas, "reseña", "reseñas")}` },
  ];
}

function ContenidoEliminar({
  negocio,
  onCerrar,
  onEliminado,
  onDesactivar,
}: {
  negocio: NegocioMetricasDto;
  onCerrar: () => void;
  onEliminado?: (id: string) => void;
  onDesactivar: (negocio: NegocioMetricasDto) => void;
}) {
  const id = useId();
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [nombreConfirmacion, setNombreConfirmacion] = useState("");
  const reautenticacion = useReautenticacion(`eliminar ${negocio.nombre}`);

  const impacto = useQuery({
    queryKey: ["admin-impacto-eliminacion", negocio.id],
    queryFn: () => adminApi.obtenerImpactoEliminacion(negocio.id),
    // Siempre las cifras de ahora: es lo que se va a borrar.
    staleTime: 0,
    gcTime: 0,
  });

  const { mutate: eliminarNegocio, isPending: eliminando } = useMutation({
    mutationFn: () => reautenticacion.conReautenticacion((prueba) => adminApi.eliminarNegocio(negocio.id, prueba)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      onCerrar();
      toast("Negocio eliminado correctamente");
      onEliminado?.(negocio.id);
    },
    onError: (err) => {
      if (esCancelacion(err)) return;
      toast(mensajeError(err, "Error al eliminar el negocio."), "error");
    },
  });

  if (reautenticacion.formulario) return reautenticacion.formulario;

  const coincide = normalizar(nombreConfirmacion) === normalizar(negocio.nombre);
  const datos = impacto.data;

  return (
    <div className="space-y-4">
      <section aria-labelledby={`${id}-impacto`} className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4">
        <h3 id={`${id}-impacto`} className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-300">
          <AlertTriangle size={16} aria-hidden="true" /> Se borrará para siempre
        </h3>
        {impacto.isPending ? (
          <div className="mt-3 space-y-2" aria-label="Cargando lo que se borraría">
            {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-4 w-3/4" />)}
          </div>
        ) : impacto.isError ? (
          <ErrorCarga
            className="mt-3 py-6"
            mensaje="No se pudo calcular qué se borraría."
            onReintentar={() => impacto.refetch()}
            reintentando={impacto.isFetching}
          />
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300 tabular-nums list-disc pl-5">
            {filasImpacto(datos!).map((f) => (
              <li key={f.texto} className={f.alerta ? "font-semibold text-red-800 dark:text-red-300" : undefined}>{f.texto}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          También la página <span className="font-mono">/b/{negocio.slug}</span>, sus horarios y su configuración. No se puede deshacer.
        </p>
      </section>

      {/* La alternativa recomendada va antes del campo de confirmación (I3). */}
      {datos?.activo !== false ? (
        <section aria-labelledby={`${id}-alternativa`} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 id={`${id}-alternativa`} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Recomendado: desactivarlo
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            La página deja de aceptar reservas y no se pierde nada. Puedes volver a activarlo cuando quieras.
          </p>
          <button
            type="button"
            onClick={() => onDesactivar(negocio)}
            className={`${BOTON_PIE_SECUNDARIO} mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2`}
          >
            <PowerOff size={14} aria-hidden="true" /> Desactivar en su lugar
          </button>
        </section>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          El negocio ya está desactivado: sus clientes no lo ven y sus datos siguen guardados.
        </p>
      )}

      <div>
        <label htmlFor={`${id}-nombre`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Para eliminarlo, escribe su nombre: <span className="font-semibold text-slate-900 dark:text-white">{negocio.nombre}</span>
        </label>
        <input
          id={`${id}-nombre`}
          type="text"
          autoComplete="off"
          value={nombreConfirmacion}
          onChange={(e) => setNombreConfirmacion(e.target.value)}
          placeholder={negocio.nombre}
          aria-describedby={`${id}-nombre-ayuda`}
          className={`${CAMPO_MODAL} ${CAMPO_OK}`}
        />
        <p id={`${id}-nombre-ayuda`} className="text-xs text-muted-foreground mt-1" aria-live="polite">
          {nombreConfirmacion && !coincide ? "El nombre no coincide todavía." : "No importan las mayúsculas."}
        </p>
      </div>

      <ModalAcciones>
        <button type="button" onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => eliminarNegocio()}
          disabled={!coincide || !datos || eliminando}
          className={`${BOTON_PIE} font-semibold bg-red-700 hover:bg-red-800 text-white`}
        >
          {eliminando ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </ModalAcciones>
    </div>
  );
}
