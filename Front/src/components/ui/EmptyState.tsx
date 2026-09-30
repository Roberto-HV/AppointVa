import type { ReactNode } from "react";
import { SearchX, X } from "lucide-react";

/**
 * "vacio": todavía no hay datos que mostrar.
 * "sinResultados": hay datos, pero los filtros actuales no devuelven ninguno.
 */
export type VarianteEmptyState = "vacio" | "sinResultados";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variante?: VarianteEmptyState;
  /**
   * Solo para "sinResultados": muestra un botón de restablecer si no se pasó
   * `action`. Sin esto, la variante queda informativa y sin salida.
   */
  onLimpiarFiltros?: () => void;
  labelLimpiarFiltros?: string;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  variante = "vacio",
  onLimpiarFiltros,
  labelLimpiarFiltros = "Limpiar filtros",
  className = "",
}: EmptyStateProps) {
  const sinResultados = variante === "sinResultados";
  const iconoMostrado = icon ?? (sinResultados ? <SearchX size={40} strokeWidth={1.5} /> : null);

  const accion =
    action ??
    (sinResultados && onLimpiarFiltros ? (
      <button
        type="button"
        onClick={onLimpiarFiltros}
        className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:border-slate-400 dark:hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
      >
        <X size={14} aria-hidden="true" />
        {labelLimpiarFiltros}
      </button>
    ) : null);

  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      {iconoMostrado && <div className="mb-3 text-gray-300 dark:text-slate-600">{iconoMostrado}</div>}
      <p className="font-medium text-gray-600 dark:text-slate-300">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 dark:text-slate-500 mt-1 max-w-xs">{description}</p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
