import type { ComponentType } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DatePicker } from "../ui/DateTimePicker";
import { ESTADO_CITA, ESTADOS_CITA } from "../../lib/estadoCita";

// ── Controles compartidos de la agenda ────────────────────────────────────────
//
// Calendario y Línea de tiempo tenían cada uno su barra: "‹ Anterior / Siguiente ›"
// con un "Hoy" que parecía texto suelto en uno, y chevrons, selector y un "Hoy"
// deshabilitado en el otro; la leyenda era de chips en uno y de puntos en el otro.
// Al cambiar de pestaña cambiaba la manera de moverse por las fechas (I3). Las
// dos vistas usan ahora la misma barra y la misma leyenda.

const BOTON_NAV =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] " +
  "rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 " +
  "hover:bg-slate-50 dark:hover:bg-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface OpcionVistaAgenda<T extends string> {
  id: T;
  etiqueta: string;
  Icono: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}

interface BarraProps<T extends string> {
  /** Rango o día visible, p. ej. "26 oct — 1 nov 2026". */
  etiqueta: string;
  /** Nombre del paso: "Día anterior", "Semana anterior". */
  etiquetaAnterior: string;
  etiquetaSiguiente: string;
  onAnterior: () => void;
  onSiguiente: () => void;
  onHoy: () => void;
  /** Día seleccionado ("YYYY-MM-DD") para el selector "Ir a una fecha". */
  fecha: string;
  onElegirFecha: (fecha: string) => void;
  vistas?: OpcionVistaAgenda<T>[];
  vista?: T;
  onCambiarVista?: (v: T) => void;
}

export function BarraFechaAgenda<T extends string>({
  etiqueta, etiquetaAnterior, etiquetaSiguiente, onAnterior, onSiguiente, onHoy,
  fecha, onElegirFecha, vistas, vista, onCambiarVista,
}: BarraProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onAnterior} className={BOTON_NAV} aria-label={etiquetaAnterior}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={onHoy} className={`${BOTON_NAV} px-3`}>
          Hoy
        </button>
        <button type="button" onClick={onSiguiente} className={BOTON_NAV} aria-label={etiquetaSiguiente}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {/* El rango se anuncia al cambiar: los botones solo dicen "anterior/siguiente". */}
      <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 px-1" aria-live="polite">
        {etiqueta}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <div className="w-40 hidden sm:block">
          <DatePicker value={fecha} onChange={(v) => v && onElegirFecha(v)} ariaLabel="Ir a una fecha" />
        </div>
        {vistas && vista && onCambiarVista && (
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5 shrink-0" role="group" aria-label="Vista del calendario">
            {vistas.map(({ id, etiqueta: e, Icono }) => (
              <button
                key={id}
                type="button"
                onClick={() => onCambiarVista(id)}
                aria-pressed={vista === id}
                aria-label={`Vista ${e.toLowerCase()}`}
                className={`flex items-center justify-center gap-1 px-2.5 min-h-[44px] min-w-[44px] lg:min-h-[32px] lg:min-w-0 text-xs font-medium rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  vista === id
                    ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Icono size={13} aria-hidden={true} />
                <span className="hidden sm:inline">{e}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Leyenda de estados: los mismos colores e iconos que los bloques de la rejilla. */
export function LeyendaEstados({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex gap-2 flex-wrap text-xs ${className}`} aria-label="Leyenda de estados">
      {ESTADOS_CITA.map((estado) => {
        const { bloque, etiqueta, Icono } = ESTADO_CITA[estado];
        return (
          <li key={estado} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${bloque}`}>
            <Icono size={12} aria-hidden="true" /> {etiqueta}
          </li>
        );
      })}
    </ul>
  );
}

/** Hueco elegido en la rejilla para crear una cita. */
export interface HuecoAgenda {
  inicio: Date;
  /** Columna de un empleado (Línea de tiempo) o el filtro activo (Calendario). */
  empleadoId?: string;
}
