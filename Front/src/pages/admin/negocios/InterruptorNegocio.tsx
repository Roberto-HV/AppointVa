import { useId } from "react";

/**
 * Interruptor con su etiqueta, en la tarjeta y en la ficha del negocio.
 *
 * La etiqueta es parte del `<button role="switch">` y no un `<span>` suelto al
 * lado: así el nombre accesible sale del propio contenido y el área táctil
 * incluye el texto, que es lo que la gente toca en un teléfono.
 */
export default function InterruptorNegocio({
  etiqueta,
  activo,
  onToggle,
  colorActivo,
  anillo,
  descripcion,
}: {
  etiqueta: string;
  activo: boolean;
  onToggle: () => void;
  colorActivo: string;
  anillo: string;
  /** Una línea bajo la etiqueta (en la ficha, qué hace el interruptor). */
  descripcion?: string;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      // Con descripción, el nombre sigue siendo solo la etiqueta y la línea de
      // abajo se anuncia como descripción.
      aria-labelledby={descripcion ? `${id}-etiqueta` : undefined}
      aria-describedby={descripcion ? `${id}-descripcion` : undefined}
      onClick={onToggle}
      className={`flex items-center gap-2 min-h-[44px] lg:min-h-[36px] rounded-lg px-1 -mx-1 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40 focus-visible:outline-none focus-visible:ring-2 ${anillo}`}
    >
      <span className="flex-1 min-w-0">
        <span
          id={`${id}-etiqueta`}
          className={`block truncate ${descripcion ? "text-sm font-medium text-slate-800 dark:text-slate-200" : "text-xs text-slate-500 dark:text-slate-400"}`}
        >
          {etiqueta}
        </span>
        {descripcion && (
          <span id={`${id}-descripcion`} className="block text-xs text-slate-500 dark:text-slate-400">{descripcion}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          activo ? colorActivo : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            activo ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
