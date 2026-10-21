import { AlertTriangle } from "lucide-react";

interface Props {
  /** Qué no se pudo cargar, p. ej. "No se pudieron cargar los ingresos." */
  mensaje: string;
  onReintentar: () => void;
  reintentando?: boolean;
  className?: string;
}

/**
 * Error de carga en línea, con "Reintentar". Un fallo del servidor no debe
 * leerse como una lista vacía, ni sugerir que el problema son los filtros.
 */
export default function ErrorCarga({ mensaje, onReintentar, reintentando = false, className = "" }: Props) {
  return (
    <div role="alert" className={`bg-card rounded-xl border border-border px-4 py-10 text-center ${className}`}>
      <AlertTriangle size={28} className="mx-auto mb-2 text-red-700 dark:text-red-400" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{mensaje}</p>
      <p className="text-sm text-muted-foreground mb-4">Revisa tu conexión e intenta de nuevo.</p>
      <button
        type="button"
        onClick={onReintentar}
        disabled={reintentando}
        className="min-h-[44px] lg:min-h-[36px] px-4 rounded-xl border border-border bg-card text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {reintentando ? "Reintentando…" : "Reintentar"}
      </button>
    </div>
  );
}
