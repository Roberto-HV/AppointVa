import { Banknote, CheckCircle2, Receipt, AlarmClock } from "lucide-react";
import { citaPorCerrar } from "../../lib/estadoCita";
import EstadoBadge from "../ui/EstadoBadge";
import AccionesCita, { type AccionExtraCita, type VistaHoja } from "./AccionesCita";
import { formatFechaCorta, formatHora, formatPrecio } from "../../utils/formatters";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import type { CitaDto } from "../../types";

// ── Tarjeta de una cita (teléfono) ────────────────────────────────────────────
//
// Por debajo de `sm` la tabla de citas medía más que la pantalla y las acciones
// de cada fila quedaban fuera, solo alcanzables con scroll horizontal. Aquí la
// cita se apila en una tarjeta y sus acciones (WhatsApp, la principal y "···")
// quedan siempre a la vista, con objetivos táctiles de 44px.

/**
 * "Por cerrar": la cita ya terminó y sigue Pendiente/Confirmada. Antes esas
 * filas se atenuaban justo cuando necesitaban atención.
 */
export function InsigniaPorCerrar({ cita, ahora }: { cita: CitaDto; ahora?: Date }) {
  if (!citaPorCerrar(cita, ahora)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border border-status-pending-dot text-status-pending-fg">
      <AlarmClock size={11} aria-hidden="true" /> Por cerrar
    </span>
  );
}

/** Insignias de "por cerrar", anticipo y comprobante; las comparten la fila y la tarjeta. */
export function InsigniasCita({ cita }: { cita: CitaDto }) {
  return (
    <>
      <InsigniaPorCerrar cita={cita} />
      {cita.anticipoRequerido && (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border-[1.5px] bg-transparent ${
          cita.anticipoRecibido
            ? "border-emerald-400 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400"
            : "border-amber-400 text-amber-700 dark:border-amber-500 dark:text-amber-500"
        }`}>
          {cita.anticipoRecibido
            ? <><CheckCircle2 size={11} /> Anticipo</>
            : <><Banknote size={11} /> Anticipo</>
          }
        </span>
      )}
      {cita.comprobanteUrl && cita.estadoTexto === "Pendiente" && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border border-border text-muted-foreground">
          <Receipt size={11} aria-hidden="true" /> Comprobante
        </span>
      )}
    </>
  );
}

interface Props {
  cita: CitaDto;
  accionesExtra: AccionExtraCita[];
  nombreNegocio?: string | null;
  /** Muestra si la cita ya está pagada (módulo de pagos activo). */
  mostrarPago?: boolean;
  /** Ver `AccionesCita`: el padre renderiza la hoja para que sobreviva a cambios de diseño. */
  onAbrirHoja?: (vista: VistaHoja) => void;
}

export default function TarjetaCita({ cita, accionesExtra, nombreNegocio, mostrarPago = false, onAbrirHoja }: Props) {
  const terms = useSectorTerms();
  return (
    <article aria-label={`${terms.cita} de ${cita.nombreCliente}`} className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{cita.nombreCliente}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {cita.nombreServicio} · {cita.nombreEmpleado}
          </p>
        </div>
        <div className="shrink-0">
          <EstadoBadge estado={cita.estadoTexto} />
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        {formatFechaCorta(cita.inicioEn)} · {formatHora(cita.inicioEn)}
        <span className="text-gray-300 dark:text-gray-600" aria-hidden="true"> · </span>
        <span className="font-medium text-gray-800 dark:text-gray-200">{formatPrecio(cita.precio)}</span>
        {mostrarPago && (
          <span className={cita.pagada ? "text-emerald-700 dark:text-emerald-300" : "text-gray-400 dark:text-gray-500"}>
            {cita.pagada ? ` · ${cita.metodoPago ?? "Pagado"}` : " · Por pagar"}
          </span>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <InsigniasCita cita={cita} />
        </div>
        <AccionesCita cita={cita} accionesExtra={accionesExtra} nombreNegocio={nombreNegocio} className="ml-auto" onAbrirHoja={onAbrirHoja} />
      </div>
    </article>
  );
}
