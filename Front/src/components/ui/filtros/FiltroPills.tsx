import { useRef } from "react";
import { cn } from "../../../lib/utils";
import type { OpcionFiltro } from "./tipos";

interface FiltroPillsProps {
  /** Id del elemento que etiqueta al grupo (`aria-labelledby`). */
  labelId: string;
  valor: string;
  onChange: (valor: string) => void;
  opciones: OpcionFiltro[];
  className?: string;
}

/**
 * Grupo de pills mutuamente excluyentes.
 *
 * Semántica de `radiogroup`: un solo tab-stop y navegación con flechas, que es
 * lo que espera un lector de pantalla de un grupo de opción única.
 */
export default function FiltroPills({ labelId, valor, onChange, opciones, className }: FiltroPillsProps) {
  const grupoRef = useRef<HTMLDivElement>(null);

  const indiceActivo = Math.max(0, opciones.findIndex((o) => o.valor === valor));

  const mover = (delta: number) => {
    const destino = (indiceActivo + delta + opciones.length) % opciones.length;
    onChange(opciones[destino].valor);
    const botones = grupoRef.current?.querySelectorAll<HTMLButtonElement>("[role=radio]");
    botones?.[destino]?.focus();
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        mover(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        mover(-1);
        break;
      case "Home":
        e.preventDefault();
        mover(-indiceActivo);
        break;
      case "End":
        e.preventDefault();
        mover(opciones.length - 1 - indiceActivo);
        break;
    }
  };

  return (
    <div
      ref={grupoRef}
      role="radiogroup"
      aria-labelledby={labelId}
      onKeyDown={alTeclear}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {opciones.map((opcion, i) => {
        const seleccionada = opcion.valor === valor;
        return (
          <button
            key={opcion.valor || "neutro"}
            type="button"
            role="radio"
            aria-checked={seleccionada}
            tabIndex={i === indiceActivo ? 0 : -1}
            onClick={() => onChange(opcion.valor)}
            className={cn(
              "min-h-[44px] lg:min-h-[36px] px-3.5 lg:px-3 inline-flex items-center gap-1.5",
              "rounded-full border text-sm lg:text-xs font-medium whitespace-nowrap transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40",
              seleccionada
                ? "bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600"
                : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
            )}
          >
            {opcion.etiqueta}
            {opcion.conteo !== undefined && (
              <span
                className={cn(
                  "text-[11px] tabular-nums rounded-full px-1.5 py-0.5",
                  seleccionada
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400"
                )}
              >
                {opcion.conteo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
