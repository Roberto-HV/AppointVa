import { cn } from "../../../lib/utils";
import { DatePicker } from "../DateTimePicker";
import type { PresetRango } from "./tipos";

interface FiltroRangoFechasProps {
  /** Id del elemento que etiqueta al bloque completo. */
  labelId: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  presets?: PresetRango[];
}

/**
 * Par "Desde / Hasta" con atajos de período.
 *
 * Los dos DatePicker comparten fila; su popover ya se sujeta al viewport, así
 * que el segundo calendario no se sale por el borde derecho en móvil.
 *
 * En escritorio el rango continúa en la misma fila, justo después del último
 * atajo, en vez de caer a un segundo renglón. En móvil sí baja, y el bloque
 * queda centrado.
 */
export default function FiltroRangoFechas({
  labelId,
  etiqueta,
  desde,
  hasta,
  onChange,
  presets,
}: FiltroRangoFechasProps) {
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col items-center gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3 lg:gap-y-2"
    >
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 lg:justify-start">
          {presets.map((preset) => {
            const activo = desde === preset.desde && hasta === preset.hasta;
            return (
              <button
                key={preset.etiqueta}
                type="button"
                aria-pressed={activo}
                onClick={() => onChange(preset.desde, preset.hasta)}
                className={cn(
                  "min-h-[44px] lg:min-h-[36px] px-3 inline-flex items-center rounded-lg border",
                  "text-sm lg:text-xs font-medium whitespace-nowrap transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40",
                  activo
                    ? "bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600"
                    : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                )}
              >
                {preset.etiqueta}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex w-full items-center gap-2 lg:w-auto">
        <div className="flex-1 min-w-0 lg:w-40 lg:flex-none">
          <DatePicker
            value={desde}
            onChange={(v) => onChange(v, hasta)}
            ariaLabel={`${etiqueta} — desde`}
          />
        </div>
        <span aria-hidden="true" className="text-gray-400 dark:text-slate-500 text-sm shrink-0">–</span>
        <div className="flex-1 min-w-0 lg:w-40 lg:flex-none">
          <DatePicker
            value={hasta}
            onChange={(v) => onChange(desde, v)}
            minDate={desde || undefined}
            ariaLabel={`${etiqueta} — hasta`}
          />
        </div>
      </div>
    </div>
  );
}
