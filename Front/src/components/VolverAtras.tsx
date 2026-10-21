import { ChevronLeft } from "lucide-react";
import { useVolverAtras } from "../hooks/useVolverAtras";

interface Props {
  /** Destino cuando no hay página anterior en esta pestaña. */
  respaldo?: string;
  className?: string;
}

/**
 * "Volver" que nunca queda inerte (AP-15). Si la página se abrió en una pestaña
 * nueva (p. ej. los enlaces legales del registro, `target="_blank"`), no hay
 * historial: react-router marca esa primera entrada con `key === "default"`, y
 * entonces se navega al `respaldo`.
 */
export default function VolverAtras({ respaldo = "/", className = "" }: Props) {
  const { volver } = useVolverAtras(respaldo);

  return (
    <button
      type="button"
      onClick={volver}
      className={`inline-flex items-center gap-1 min-h-[44px] -ml-2 px-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 ${className}`}
    >
      <ChevronLeft size={18} aria-hidden="true" />
      Volver
    </button>
  );
}
