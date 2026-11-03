import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Power, Store } from "lucide-react";
import EmptyState from "../../components/ui/EmptyState";
import ErrorCarga from "../../components/ui/ErrorCarga";
import MenuAcciones from "../../components/ui/MenuAcciones";
import Tabs from "../../components/ui/Tabs";
import { Skeleton } from "../../components/ui/Skeleton";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import { nombrePlan } from "../../utils/negociosAdmin";
import { RUTA_NEGOCIOS_ADMIN, type SeccionNegocio } from "../../layouts/rutasAdmin";
import { useDatosNegocios } from "./negocios/useDatosNegocios";
import { useAccionesNegocio } from "./negocios/useAccionesNegocio";
import BadgeSuscripcion from "./negocios/BadgeSuscripcion";
import LogoNegocio from "./negocios/LogoNegocio";
import SuscripcionNegocio from "./negocios/SuscripcionNegocio";
import { EstadoNegocio, accionesSecundarias } from "./negocios/TarjetaNegocio";
import { ConfiguracionNegocio, PropietarioNegocio, ResumenNegocio } from "./negocios/detalle/SeccionesNegocio";
import ActividadNegocio from "./negocios/detalle/ActividadNegocio";
import { ACCION_TARJETA, SUPERFICIE, TINTE_ACTIVAR, TINTE_DESACTIVAR } from "./negocios/estilos";

const SECCIONES: { id: SeccionNegocio; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "suscripcion", label: "Suscripción y pagos" },
  { id: "propietario", label: "Propietario" },
  { id: "configuracion", label: "Configuración" },
  { id: "actividad", label: "Actividad" },
];

const esSeccion = (valor: string | null): valor is SeccionNegocio => SECCIONES.some((s) => s.id === valor);

const VOLVER =
  "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[32px] -ml-1 px-1 mb-3 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 " +
  "hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40";

/**
 * Ficha de un negocio (lote 4, I1): reúne lo que estaba repartido entre la
 * tarjeta y cinco modales —resumen, suscripción y pagos, propietario,
 * configuración— y añade su actividad sacada del registro de auditoría. Las
 * acciones son las mismas de la lista (`useAccionesNegocio`), con las mismas
 * confirmaciones; nada cambia en cómo se guardan.
 *
 * La sección va en `?seccion=` para poder enlazarla (Facturación abre
 * directo "Suscripción y pagos"). Cambiar de pestaña reemplaza la entrada del
 * historial: "Atrás" regresa a la lista, no a la pestaña anterior.
 */
export default function NegocioDetalleAdminPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const crudo = params.get("seccion");
  const seccion: SeccionNegocio = esSeccion(crudo) ? crudo : "resumen";
  const irA = (s: SeccionNegocio) => setParams(s === "resumen" ? {} : { seccion: s }, { replace: true });

  const datos = useDatosNegocios();
  // Tras eliminarlo, la ficha ya no tiene a quién mostrar: vuelve a la lista.
  const acciones = useAccionesNegocio({ onEliminado: () => navigate(RUTA_NEGOCIOS_ADMIN, { replace: true }) });
  const negocio = datos.metricas.find((n) => n.id === id);
  const suscripcion = datos.suscripcionMap[id];

  useTituloPagina(negocio ? `${negocio.nombre} · Admin` : "Negocio · Admin");

  const volver = (
    <Link to={RUTA_NEGOCIOS_ADMIN} className={VOLVER}>
      <ArrowLeft size={16} aria-hidden="true" /> Negocios
    </Link>
  );

  if (datos.cargandoMetricas) {
    return (
      <div className="p-4 sm:p-8">
        {volver}
        <div role="status" aria-label="Cargando negocio" className="space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        {acciones.modales}
      </div>
    );
  }

  // Solo sin datos es un error de página completa. Si falla la recarga que
  // dispara cada acción (invalidar), TanStack conserva la caché: la ficha y
  // cualquier modal abierto siguen en pie, con un aviso que no bloquea.
  if (datos.errorMetricas && !datos.hayMetricas) {
    return (
      <div className="p-4 sm:p-8">
        {volver}
        <ErrorCarga
          className="py-10"
          mensaje="No se pudo cargar el negocio."
          onReintentar={() => datos.recargarMetricas()}
          reintentando={datos.recargandoMetricas}
        />
        {acciones.modales}
      </div>
    );
  }

  const avisoRecarga = datos.errorMetricas && (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      <span>No se pudieron actualizar los datos; se muestra la última versión cargada.</span>
      <button
        type="button"
        onClick={() => datos.recargarMetricas()}
        disabled={datos.recargandoMetricas}
        className="font-medium underline underline-offset-2 disabled:opacity-60"
      >
        {datos.recargandoMetricas ? "Reintentando…" : "Reintentar"}
      </button>
    </div>
  );

  if (!negocio) {
    return (
      <div className="p-4 sm:p-8">
        {volver}
        {avisoRecarga}
        <div className={SUPERFICIE}>
          <EmptyState
            icon={<Store size={32} strokeWidth={1.5} />}
            title="No encontramos este negocio"
            description="Puede que se haya eliminado o que el enlace esté incompleto."
            action={<Link to={RUTA_NEGOCIOS_ADMIN} className="text-sm font-medium underline underline-offset-2">Ver todos los negocios</Link>}
          />
        </div>
        {acciones.modales}
      </div>
    );
  }

  const esActivo = negocio.activo === 1;
  const cambiando = acciones.cambiandoEstado(negocio.id);

  return (
    <div className="p-4 sm:p-8">
      {volver}
      {avisoRecarga}

      {/* Encabezado: quién es, en qué estado está y las dos acciones del día. */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <LogoNegocio negocio={negocio} tamano="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">{negocio.nombre}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate">/b/{negocio.slug}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <EstadoNegocio negocio={negocio} />
              <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                {negocio.planNombre ? nombrePlan(negocio.planNombre) : "Sin plan"}
              </span>
              {suscripcion && (
                <BadgeSuscripcion
                  estado={suscripcion.estado}
                  dias={suscripcion.diasRestantes}
                  vence={suscripcion.fechaVencimiento}
                  conPlan={!!suscripcion.planNombre}
                />
              )}
              {negocio.esTester && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  Tester
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => (esActivo ? acciones.pedirDesactivar(negocio) : acciones.activar(negocio))}
            disabled={cambiando}
            className={`${ACCION_TARJETA} px-3 flex-1 sm:flex-none ${esActivo ? TINTE_DESACTIVAR : TINTE_ACTIVAR}`}
          >
            <Power size={12} aria-hidden="true" />
            {cambiando ? "Guardando…" : esActivo ? "Desactivar" : "Activar"}
          </button>
          <MenuAcciones
            etiqueta={`Más acciones de ${negocio.nombre}`}
            acciones={accionesSecundarias(negocio, {
              onConfirmarEmail: () => acciones.pedirConfirmarCorreo(negocio),
              onColores: () => acciones.abrirColores(negocio),
              onEliminar: () => acciones.abrirEliminar(negocio),
            })}
          />
        </div>
      </div>

      <Tabs className="mb-5" etiqueta="Secciones del negocio" valor={seccion} onChange={irA} opciones={SECCIONES} />

      {seccion === "resumen" && (
        <ResumenNegocio negocio={negocio} suscripcion={suscripcion} acciones={acciones} onIrA={irA} />
      )}

      {seccion === "suscripcion" && (
        datos.errorSuscripciones ? (
          <ErrorCarga
            className="py-8"
            mensaje="No se pudo cargar la suscripción."
            onReintentar={() => datos.recargarSuscripciones()}
            reintentando={datos.recargandoSuscripciones}
          />
        ) : datos.cargandoSuscripciones ? (
          // Sin la fila de suscripción el borrador de empleados extra arrancaría
          // en cero: se espera a tenerla antes de montar el formulario.
          <div role="status" aria-label="Cargando suscripción" className="space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <div className={`${SUPERFICIE} p-4 sm:p-5`}>
            <SuscripcionNegocio
              key={negocio.id}
              negocio={negocio}
              suscripcion={suscripcion}
              planes={datos.planes}
              errorPlanes={datos.errorPlanes}
              onReintentarPlanes={() => datos.recargarPlanes()}
              completa
            />
          </div>
        )
      )}

      {seccion === "propietario" && <PropietarioNegocio negocio={negocio} acciones={acciones} />}
      {seccion === "configuracion" && <ConfiguracionNegocio negocio={negocio} acciones={acciones} />}
      {seccion === "actividad" && <ActividadNegocio negocioId={negocio.id} />}

      {acciones.modales}
    </div>
  );
}
