import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { SuscripcionResumenDto } from "../../../api/admin";
import { formatPrecio } from "../../../utils/formatters";
import { motivoSinIngreso, nombrePlan, type ResumenFacturacion } from "../../../utils/negociosAdmin";
import { rutaNegocioAdmin } from "../../../layouts/rutasAdmin";
import { badgeFacturacion, textoVence } from "./formatoSuscripcion";

const ENLACE_NEGOCIO =
  "hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40";

/**
 * Empleados extra en una fila de Facturación. Ya no se guarda al salir del
 * campo (I2): mientras el valor difiere del guardado aparece "Guardar" con el
 * nuevo total, así el cambio de cobro se ve antes de aplicarse.
 */
function EmpleadosExtraFila({
  suscripcion,
  guardando,
  onGuardar,
}: {
  suscripcion: SuscripcionResumenDto;
  guardando: boolean;
  onGuardar: (valor: number) => void;
}) {
  const [valor, setValor] = useState(suscripcion.empleadosExtra);
  // Si el dato guardado cambia (otro guardado, una recarga), el borrador lo sigue.
  const [guardadoPrevio, setGuardadoPrevio] = useState(suscripcion.empleadosExtra);
  if (suscripcion.empleadosExtra !== guardadoPrevio) {
    setGuardadoPrevio(suscripcion.empleadosExtra);
    setValor(suscripcion.empleadosExtra);
  }
  const cambiado = valor !== suscripcion.empleadosExtra;
  const nuevoTotal = suscripcion.precioBase + valor * suscripcion.precioEmpleadoExtra;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="number"
        min={0}
        aria-label={`Empleados extra de ${suscripcion.negocioNombre}`}
        value={valor}
        onChange={(e) => setValor(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        onKeyDown={(e) => { if (e.key === "Escape") setValor(suscripcion.empleadosExtra); }}
        disabled={guardando}
        className="w-14 text-center tabular-nums rounded-lg border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
      />
      {cambiado && (
        <button
          type="button"
          onClick={() => onGuardar(valor)}
          disabled={guardando}
          aria-label={`Guardar ${valor} empleados extra de ${suscripcion.negocioNombre}: total ${formatPrecio(nuevoTotal)} al mes`}
          className="min-h-[36px] px-2.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-600 dark:hover:bg-slate-500 text-xs font-semibold tabular-nums whitespace-nowrap disabled:opacity-50"
        >
          {guardando ? "Guardando…" : `Guardar · ${formatPrecio(nuevoTotal)}`}
        </button>
      )}
    </div>
  );
}

/**
 * Facturación en el teléfono (I6): una tarjeta por negocio con lo que el admin
 * busca primero —nombre e ingreso arriba, estado y vencimiento debajo— y "Ver
 * suscripción" como acción. Los empleados extra se editan dentro del modal.
 * El pie es el mismo de la tabla: el ingreso de todas las filas, no el de la página.
 */
export function TarjetasFacturacion({
  filas,
  resumen,
  onVerSuscripcion,
  paginacion,
}: {
  filas: SuscripcionResumenDto[];
  resumen: ResumenFacturacion;
  onVerSuscripcion: (s: SuscripcionResumenDto) => void;
  paginacion: ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      <ul aria-label="Suscripciones" className="divide-y divide-slate-100 dark:divide-slate-700">
        {filas.map((s) => {
          const badge = badgeFacturacion(s);
          const sinIngreso = motivoSinIngreso(s);
          return (
            <li key={s.negocioId} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium text-slate-800 dark:text-slate-200 truncate">
                  <Link to={rutaNegocioAdmin(s.negocioId, "suscripcion")} className={ENLACE_NEGOCIO}>{s.negocioNombre}</Link>
                </p>
                <p className="shrink-0 text-right tabular-nums">
                  {sinIngreso ? (
                    <span title={sinIngreso} className="text-sm text-slate-500 dark:text-slate-400">Sin ingreso</span>
                  ) : (
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatPrecio(s.ingresoMensual)}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mes</span>
                    </span>
                  )}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap text-xs">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                {textoVence(s) !== '—' && (
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">Vence: {textoVence(s)}</span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                {/* El motivo de "Sin ingreso" ya lo dice la insignia; aquí, el plan. */}
                <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {s.planNombre ? `${nombrePlan(s.planNombre)} · ${formatPrecio(s.totalMensual)}/mes de lista` : 'Sin plan'}
                  {s.empleadosExtra > 0 && ` · +${s.empleadosExtra} emp. extra`}
                </p>
                <button
                  type="button"
                  onClick={() => onVerSuscripcion(s)}
                  aria-label={`Ver suscripción de ${s.negocioNombre}`}
                  className="shrink-0 min-h-[44px] px-3 -mr-1 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
                >
                  Ver suscripción
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Ingreso mensual · {resumen.conSuscripcionVigente} de {resumen.conPlanAsignado} con suscripción vigente
        </p>
        <p data-testid="total-ingreso-mensual" className="shrink-0 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {formatPrecio(resumen.ingresoMensual)}
        </p>
      </div>
      {paginacion}
    </div>
  );
}

/** Facturación en escritorio: una fila por negocio y el pie con el ingreso de todas. */
export function TablaFacturacion({
  filas,
  resumen,
  onVerSuscripcion,
  guardandoExtraDe,
  onGuardarExtra,
  paginacion,
}: {
  filas: SuscripcionResumenDto[];
  resumen: ResumenFacturacion;
  onVerSuscripcion: (s: SuscripcionResumenDto) => void;
  /** Negocio cuyos empleados extra se están guardando, si hay uno. */
  guardandoExtraDe: string | null;
  onGuardarExtra: (s: SuscripcionResumenDto, valor: number) => void;
  paginacion: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Negocio</th>
            <th className="px-4 py-3 text-left">Plan</th>
            <th className="px-4 py-3 text-center">Emp. base</th>
            <th className="px-4 py-3 text-center">Emp. extra</th>
            {/* Dos cifras distintas con nombre propio (G3): lo que cuesta
                el plan asignado y lo que de verdad entra cada mes. */}
            <th className="px-4 py-3 text-right whitespace-nowrap">Precio del plan</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Ingreso mensual</th>
            <th className="px-4 py-3 text-center">Vence</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {filas.map(s => {
            const badge = badgeFacturacion(s);
            const sinIngreso = motivoSinIngreso(s);
            return (
              <tr key={s.negocioId} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                {/* `whitespace-nowrap`: la tabla ya se desplaza en
                    horizontal; sin esto, a 390px el nombre se parte en
                    cuatro líneas y estira la fila en vez de aprovechar
                    el desplazamiento que ya existe. */}
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  <Link to={rutaNegocioAdmin(s.negocioId, "suscripcion")} className={ENLACE_NEGOCIO}>{s.negocioNombre}</Link>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.planNombre ? nombrePlan(s.planNombre) : '—'}</td>
                <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 tabular-nums">{s.maxEmpleadosBase}</td>
                <td className="px-4 py-3 text-center">
                  <EmpleadosExtraFila
                    suscripcion={s}
                    guardando={guardandoExtraDe === s.negocioId}
                    onGuardar={(valor) => onGuardarExtra(s, valor)}
                  />
                </td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  {s.planNombre ? formatPrecio(s.totalMensual) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                  {sinIngreso ? (
                    <span title={sinIngreso} className="relative font-normal text-slate-400 dark:text-slate-500">
                      —<span className="sr-only"> {sinIngreso}</span>
                    </span>
                  ) : (
                    formatPrecio(s.ingresoMensual)
                  )}
                </td>
                <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {/* Un acceso de por vida vence el año 2126: la fecha
                      es cierta y no dice nada. */}
                  {textoVence(s)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onVerSuscripcion(s)}
                    className="min-h-[44px] lg:min-h-[36px] px-2 -mx-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
                  >
                    Ver suscripción
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {/* El pie suma la columna "Ingreso mensual" de TODAS las filas,
              no las de la página ni las que pasan el filtro: es el
              ingreso del mes, y recortarlo al filtro haría que el mismo
              rótulo significara cosas distintas según lo que esté
              escrito en el buscador. Es la misma cifra del KPI. */}
          <tr className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
            <td colSpan={5} className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
              Ingreso mensual · {resumen.conSuscripcionVigente} de {resumen.conPlanAsignado} con suscripción vigente
            </td>
            <td data-testid="total-ingreso-mensual" className="px-4 py-3 text-right text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums">
              {formatPrecio(resumen.ingresoMensual)}
            </td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
    {paginacion && <div className="bg-white dark:bg-slate-800">{paginacion}</div>}
    </div>
  );
}
