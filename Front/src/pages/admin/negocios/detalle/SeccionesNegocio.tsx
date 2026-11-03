import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, MailCheck, Palette, Power, Trash2, UserPlus, KeyRound, CreditCard } from "lucide-react";
import type { NegocioMetricasDto, SuscripcionResumenDto } from "../../../../api/admin";
import BarraProgreso from "../../../../components/ui/BarraProgreso";
import EmptyState from "../../../../components/ui/EmptyState";
import { formatFecha } from "../../../../utils/formatters";
import { esClavePlan, NOMBRES_PLANES } from "../../../../lib/precios";
import { MOTIVOS_ATENCION, nombrePlan, requiereAtencion, type MotivoAtencion } from "../../../../utils/negociosAdmin";
import { RUTA_FACTURACION_ADMIN, type SeccionNegocio } from "../../../../layouts/rutasAdmin";
import InterruptorNegocio from "../InterruptorNegocio";
import { textoVence } from "../formatoSuscripcion";
import { ACCION_TARJETA, SUPERFICIE, TINTE_ACTIVAR, TINTE_DESACTIVAR, TINTE_PROPIETARIO, TINTE_SUSCRIPCION } from "../estilos";
import type { AccionesNegocio } from "../useAccionesNegocio";

// Secciones de la ficha del negocio (lote 4, I1). Reúnen lo que antes estaba
// repartido entre la tarjeta y sus modales; las acciones son las mismas
// (`useAccionesNegocio`), con sus confirmaciones y avisos.

function Tarjeta({ titulo, children, acciones }: { titulo: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section aria-label={titulo} className={`${SUPERFICIE} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{titulo}</h2>
        {acciones}
      </div>
      {children}
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{etiqueta}</dt>
      <dd className="text-sm text-right text-slate-800 dark:text-slate-200 min-w-0 break-words tabular-nums">{children}</dd>
    </div>
  );
}

const ENLACE =
  "inline-flex items-center gap-1.5 min-h-[44px] lg:min-h-[32px] font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 " +
  "hover:text-slate-900 dark:hover:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40";

// ── Resumen ─────────────────────────────────────────────────────────────────

export function ResumenNegocio({
  negocio,
  suscripcion,
  acciones,
  onIrA,
}: {
  negocio: NegocioMetricasDto;
  suscripcion: SuscripcionResumenDto | undefined;
  acciones: AccionesNegocio;
  onIrA: (seccion: SeccionNegocio) => void;
}) {
  const motivos = MOTIVOS_ATENCION.filter((m) => requiereAtencion(negocio, suscripcion, m.id));
  const urlReservas = `${window.location.origin}/b/${negocio.slug}`;

  /** La acción directa de cada motivo: lo que el admin haría a continuación. */
  const accionDe = (motivo: MotivoAtencion): ReactNode => {
    switch (motivo) {
      case "pendientes":
        return (
          <button type="button" onClick={() => acciones.activar(negocio)} disabled={acciones.cambiandoEstado(negocio.id)}
            className={`${ACCION_TARJETA} ${TINTE_ACTIVAR}`}>
            <Power size={12} aria-hidden="true" /> {acciones.cambiandoEstado(negocio.id) ? "Guardando…" : "Activar"}
          </button>
        );
      case "correoSinVerificar":
        return (
          <button type="button" onClick={() => acciones.pedirConfirmarCorreo(negocio)} className={`${ACCION_TARJETA} ${TINTE_PROPIETARIO}`}>
            <MailCheck size={12} aria-hidden="true" /> Confirmar correo
          </button>
        );
      default:
        return (
          <button type="button" onClick={() => onIrA("suscripcion")} className={`${ACCION_TARJETA} ${TINTE_SUSCRIPCION}`}>
            <CreditCard size={12} aria-hidden="true" /> Registrar pago
          </button>
        );
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {motivos.length > 0 && (
        <section aria-label="Requiere atención" className="lg:col-span-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">Requiere atención</h2>
          <ul className="space-y-2">
            {motivos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{m.etiqueta}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{m.descripcion}</p>
                </div>
                {accionDe(m.id)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dos columnas que se llenan por separado: si no, "Enlaces" esperaba a
          que terminara la fila de "Datos del negocio" y quedaba un hueco. */}
      <div className="space-y-4">
      <Tarjeta titulo="Uso este mes">
        {negocio.maxCitasMes > 0
          ? <BarraProgreso valor={negocio.citasMes} maximo={negocio.maxCitasMes} label="Citas este mes" />
          : <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 tabular-nums">{negocio.citasMes} citas este mes</p>}
        {negocio.maxEmpleados > 0
          ? <BarraProgreso valor={negocio.empleadosActivos} maximo={negocio.maxEmpleados} label="Empleados" />
          : <p className="text-sm text-slate-700 dark:text-slate-300 mb-2 tabular-nums">{negocio.empleadosActivos} empleados activos</p>}
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">Correos enviados este mes: {negocio.emailsMes}</p>
      </Tarjeta>

      <Tarjeta titulo="Enlaces">
        <ul className="text-sm space-y-1">
          <li>
            <a href={`/b/${negocio.slug}`} target="_blank" rel="noopener noreferrer" className={`${ENLACE} break-all`}>
              {urlReservas} <ExternalLink size={12} aria-hidden="true" className="shrink-0" />
              <span className="sr-only"> (página de reservas, se abre en una pestaña nueva)</span>
            </a>
          </li>
          <li>
            <Link to={RUTA_FACTURACION_ADMIN} className={ENLACE}>Facturación de todos los negocios</Link>
          </li>
        </ul>
      </Tarjeta>
      </div>

      <Tarjeta titulo="Datos del negocio">
        <dl className="divide-y divide-slate-100 dark:divide-slate-700 -my-2">
          <Dato etiqueta="Alta">{negocio.fechaCreacion ? formatFecha(negocio.fechaCreacion) : "—"}</Dato>
          <Dato etiqueta="Correo del negocio">{negocio.email || "—"}</Dato>
          <Dato etiqueta="Sector">{suscripcion ? (suscripcion.sector === "salud" ? "Salud" : "Belleza") : "—"}</Dato>
          <Dato etiqueta="Plan">{negocio.planNombre ? nombrePlan(negocio.planNombre) : "Sin plan"}</Dato>
          {esClavePlan(negocio.planSolicitado) && (
            <Dato etiqueta="Plan elegido al registrarse">{NOMBRES_PLANES[negocio.planSolicitado]}</Dato>
          )}
          <Dato etiqueta="Suscripción vence">{suscripcion ? textoVence(suscripcion) : "—"}</Dato>
        </dl>
      </Tarjeta>
    </div>
  );
}

// ── Propietario ─────────────────────────────────────────────────────────────

export function PropietarioNegocio({ negocio, acciones }: { negocio: NegocioMetricasDto; acciones: AccionesNegocio }) {
  if (!negocio.propietarioEmail) {
    return (
      <div className={SUPERFICIE}>
        <EmptyState
          icon={<UserPlus size={32} strokeWidth={1.5} />}
          title="Sin propietario"
          description="Nadie puede entrar al panel de este negocio todavía. Crea la cuenta de su propietario y le enviaremos una invitación."
          action={
            <button type="button" onClick={() => acciones.abrirPropietario(negocio)} className={`${ACCION_TARJETA} px-4 ${TINTE_PROPIETARIO}`}>
              <UserPlus size={12} aria-hidden="true" /> Crear propietario
            </button>
          }
        />
      </div>
    );
  }

  return (
    <Tarjeta titulo="Propietario">
      <dl className="divide-y divide-slate-100 dark:divide-slate-700 -my-2 mb-3">
        {negocio.propietarioNombre && <Dato etiqueta="Nombre">{negocio.propietarioNombre}</Dato>}
        <Dato etiqueta="Correo de acceso">
          <a href={`mailto:${negocio.propietarioEmail}`} className="underline underline-offset-2 break-all">{negocio.propietarioEmail}</a>
        </Dato>
        <Dato etiqueta="Correo">
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              negocio.emailConfirmado
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            {negocio.emailConfirmado ? "Verificado" : "Sin verificar"}
          </span>
        </Dato>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => acciones.abrirPropietario(negocio)} className={`${ACCION_TARJETA} px-3 ${TINTE_PROPIETARIO}`}>
          <KeyRound size={12} aria-hidden="true" /> Enviar enlace de contraseña
        </button>
        {negocio.emailConfirmado === false && (
          <button type="button" onClick={() => acciones.pedirConfirmarCorreo(negocio)} className={`${ACCION_TARJETA} px-3 border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}>
            <MailCheck size={12} aria-hidden="true" /> Confirmar correo
          </button>
        )}
      </div>
    </Tarjeta>
  );
}

// ── Configuración ───────────────────────────────────────────────────────────

export function ConfiguracionNegocio({ negocio, acciones }: { negocio: NegocioMetricasDto; acciones: AccionesNegocio }) {
  const esActivo = negocio.activo === 1;
  const cambiando = acciones.cambiandoEstado(negocio.id);
  const color = negocio.colorPrimario ?? "#334155";

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Tarjeta titulo="Módulos">
        {/* Mismos interruptores que la tarjeta: aplican al instante y el aviso ofrece "Deshacer". */}
        <div className="flex flex-col gap-1">
          <InterruptorNegocio
            etiqueta="Módulo pagos"
            descripcion="Habilita la sección Pagos y el cobro de citas en su panel"
            activo={!!negocio.moduloPagosHabilitado}
            onToggle={() => acciones.togglePagos(negocio, !negocio.moduloPagosHabilitado)}
            colorActivo="bg-emerald-500"
            anillo="focus-visible:ring-emerald-500"
          />
          <InterruptorNegocio
            etiqueta="Tester"
            descripcion="Negocio de prueba: no cuenta en ninguna cifra de facturación"
            activo={!!negocio.esTester}
            onToggle={() => acciones.toggleTester(negocio)}
            colorActivo="bg-purple-500"
            anillo="focus-visible:ring-purple-500"
          />
        </div>
      </Tarjeta>

      <Tarjeta
        titulo="Colores"
        acciones={
          <button type="button" onClick={() => acciones.abrirColores(negocio)} className={`${ACCION_TARJETA} px-3 border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200`}>
            <Palette size={12} aria-hidden="true" /> Editar colores
          </button>
        }
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0" style={{ backgroundColor: color }} />
          <div>
            <p className="text-sm text-slate-800 dark:text-slate-200">Color primario</p>
            <p className="text-xs font-mono uppercase text-slate-500 dark:text-slate-400">{color}</p>
          </div>
        </div>
      </Tarjeta>

      <section aria-label="Estado y eliminación" className="lg:col-span-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Estado y eliminación</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{esActivo ? "Desactivar el negocio" : "Activar el negocio"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {esActivo
                  ? "Su página de reservas deja de aceptar citas. Se puede volver a activar."
                  : "Su página de reservas vuelve a aceptar citas."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (esActivo ? acciones.pedirDesactivar(negocio) : acciones.activar(negocio))}
              disabled={cambiando}
              className={`${ACCION_TARJETA} px-3 ${esActivo ? TINTE_DESACTIVAR : TINTE_ACTIVAR}`}
            >
              <Power size={12} aria-hidden="true" /> {cambiando ? "Guardando…" : esActivo ? "Desactivar" : "Activar"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Eliminar el negocio</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Borra sus datos para siempre. No se puede deshacer.</p>
            </div>
            <button type="button" onClick={() => acciones.abrirEliminar(negocio)} className={`${ACCION_TARJETA} px-3 ${TINTE_DESACTIVAR}`}>
              <Trash2 size={12} aria-hidden="true" /> Eliminar negocio
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
