import type { ReactNode } from "react";
import type { ServicioPublico } from "../../types";
import { formatPrecio } from "../../utils/formatters";

interface Props {
  negocioNombre: string;
  servicio: ServicioPublico | null;
  /** Quién atiende, ya resuelto ("Cualquier disponible", el asignado…), con su etiqueta del sector. */
  profesional?: { etiqueta: string; nombre: string } | null;
  /** Fecha y hora elegidas, ya formateadas. */
  fechaHora?: string | null;
  /** Precio final con el descuento aplicado, si lo hay. */
  total?: number | null;
  /** Botones del paso: los mismos manejadores que la barra de acción móvil. */
  acciones?: ReactNode;
}

/**
 * Resumen fijo de la columna derecha en escritorio, como en Fresha o Booksy: la
 * elección hasta el momento y el botón para seguir siempre a la vista, sin
 * bajar hasta el final de una lista larga de servicios. En móvil no se monta:
 * ahí manda la barra de acción fija abajo.
 */
export default function ResumenReserva({ negocioNombre, servicio, profesional, fechaHora, total, acciones }: Props) {
  const conDescuento = servicio && total != null && total !== servicio.precio;
  return (
    <aside aria-label="Resumen de tu reserva" className="tarjeta p-5">
      <p className="text-xs font-medium text-slate-500">Tu reserva en</p>
      <p className="mt-0.5 text-base font-semibold leading-snug text-slate-900 break-words">{negocioNombre}</p>

      <div className="mt-4 border-t border-slate-100 pt-4">
        {servicio ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="sr-only">Servicio</dt>
              <dd className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800 break-words">{servicio.nombre}</span>
                  <span className="block text-xs text-slate-500 tabular-nums">{`${servicio.duracionMinutos} min`}</span>
                </span>
                <span className="shrink-0 text-slate-700 tabular-nums">{formatPrecio(servicio.precio)}</span>
              </dd>
            </div>
            {profesional && (
              <div>
                <dt className="text-xs text-slate-500">{profesional.etiqueta}</dt>
                <dd className="font-medium text-slate-800">{profesional.nombre}</dd>
              </div>
            )}
            {fechaHora && (
              <div>
                <dt className="text-xs text-slate-500">Fecha y hora</dt>
                <dd className="font-medium text-slate-800 tabular-nums">{fechaHora}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Elige un servicio para continuar.</p>
        )}
      </div>

      {servicio && total != null && (
        <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-sm font-semibold text-slate-900">Total</span>
          <span className="text-right tabular-nums">
            {conDescuento && (
              <span className="mr-2 text-xs text-slate-400 line-through">{formatPrecio(servicio.precio)}</span>
            )}
            <span className="text-base font-semibold text-slate-900">{formatPrecio(total)}</span>
          </span>
        </div>
      )}

      {acciones && <div className="mt-5 space-y-2">{acciones}</div>}
    </aside>
  );
}
