import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Modal from "../ui/Modal";
import { contarCitasFuturas, enlaceCitasFuturas } from "../../lib/citasFuturas";

// Borrar un empleado o servicio con citas abiertas a futuro dejaría esas citas
// huérfanas: se bloquea y se manda a revisarlas (decisión 7, OM-17). Si existe
// una alternativa reversible (ocultar/desactivar), es la acción principal.

interface Alternativa {
  etiqueta: string;
  descripcion: string;
  pendiente?: boolean;
  onSelect: () => void;
}

interface Props {
  abierto: boolean;
  titulo: string;
  filtro: { empleadoId: string } | { servicioId: string } | null;
  /** Qué pasa si se elimina (sin citas futuras). */
  mensaje: ReactNode;
  etiquetaEliminar: string;
  eliminando?: boolean;
  /** Términos del sector: "cita"/"citas". */
  terminoCitas: { singular: string; plural: string };
  alternativa?: Alternativa;
  onEliminar: () => void;
  onCerrar: () => void;
}

const BOTON = "min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl text-sm transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function DialogoEliminarConCitas({
  abierto, titulo, filtro, mensaje, etiquetaEliminar, eliminando, terminoCitas, alternativa, onEliminar, onCerrar,
}: Props) {
  const clave = filtro ? ("empleadoId" in filtro ? `e:${filtro.empleadoId}` : `s:${filtro.servicioId}`) : "";
  const { data: conteo, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["citas-futuras", clave],
    queryFn: () => contarCitasFuturas(filtro!),
    enabled: abierto && !!filtro,
    // Sin caché: cada apertura vuelve a contar (una cita pudo crearse entre medias).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  // Falla cerrada: solo se puede eliminar con un conteo fresco, completo y en cero.
  const verificado = !!conteo && !isFetching && !isError;
  const bloqueado = verificado && conteo.total > 0;
  const sinVerificar = verificado && conteo.total === 0 && !conteo.completo;
  const puedeEliminar = verificado && conteo.total === 0 && conteo.completo;
  const cargando = isLoading || (isFetching && !isError);
  const enlace = enlaceCitasFuturas(filtro && "empleadoId" in filtro ? filtro.empleadoId : undefined);
  const nCitas = conteo?.total ?? 0;
  const textoCitas = `${conteo && !conteo.completo ? "al menos " : ""}${nCitas} ${nCitas === 1 ? terminoCitas.singular : terminoCitas.plural}`;

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={bloqueado || sinVerificar ? "No se puede eliminar todavía" : titulo} ancho="sm">
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground space-y-2">
          {cargando ? (
            <p role="status">{`Revisando ${terminoCitas.plural} futuras…`}</p>
          ) : isError ? (
            <div role="alert" className="space-y-2">
              <p>{`No se pudo comprobar si hay ${terminoCitas.plural} futuras, así que todavía no se puede eliminar.`}</p>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className="font-semibold text-foreground underline underline-offset-2 disabled:opacity-50">
                {isFetching ? "Reintentando…" : "Reintentar"}
              </button>
            </div>
          ) : bloqueado ? (
            <div role="alert" className="space-y-2">
              <p>
                {`Tiene ${textoCitas} pendientes o confirmadas desde hoy. Reagéndalas, reasígnalas o cancélalas antes de eliminarlo.`}
              </p>
              <Link to={enlace} onClick={onCerrar} className="inline-flex min-h-[44px] items-center font-semibold text-foreground underline underline-offset-2">
                {filtro && "empleadoId" in filtro ? `Ver sus ${terminoCitas.plural}` : `Ver ${terminoCitas.plural} desde hoy`}
              </Link>
            </div>
          ) : sinVerificar ? (
            <div role="alert" className="space-y-2">
              <p>
                {`No pudimos verificar todas las ${terminoCitas.plural} futuras, así que no se puede eliminar desde aquí. ${alternativa ? "Ocúltalo de reservas o revisa" : "Revisa"} sus ${terminoCitas.plural} en Citas.`}
              </p>
              <Link to={enlace} onClick={onCerrar} className="inline-flex min-h-[44px] items-center font-semibold text-foreground underline underline-offset-2">
                {`Ver ${terminoCitas.plural} desde hoy`}
              </Link>
            </div>
          ) : (
            mensaje
          )}
          {alternativa && !cargando && <p>{alternativa.descripcion}</p>}
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button type="button" onClick={onCerrar} className={`${BOTON} border border-border font-medium text-foreground hover:bg-muted`}>
            Volver
          </button>
          {puedeEliminar && (
            <button
              type="button"
              onClick={onEliminar}
              disabled={eliminando}
              className={`${BOTON} font-semibold ${alternativa ? "border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40" : "bg-red-700 hover:bg-red-800 text-white"}`}
            >
              {eliminando ? "Procesando…" : etiquetaEliminar}
            </button>
          )}
          {alternativa && (
            <button
              type="button"
              onClick={alternativa.onSelect}
              disabled={alternativa.pendiente}
              className={`${BOTON} font-semibold bg-primary text-primary-foreground hover:opacity-90`}
            >
              {alternativa.pendiente ? "Procesando…" : alternativa.etiqueta}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
