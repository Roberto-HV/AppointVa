import type { ReactNode } from "react";
import { SearchX, X } from "lucide-react";
import { textoVacio, type ClaveVacio, type TonoVacio } from "../../lib/vozVacia";

/**
 * "vacio": todavía no hay datos que mostrar.
 * "sinResultados": hay datos, pero los filtros actuales no devuelven ninguno.
 */
export type VarianteEmptyState = "vacio" | "sinResultados";

interface EmptyStateProps {
  icon?: ReactNode;
  /** Obligatorio salvo que se pase `voz`, que trae su propio texto. */
  title?: string;
  description?: string;
  action?: ReactNode;
  variante?: VarianteEmptyState;
  /**
   * Tono del sector ("belleza" cálido, "salud" sobrio). Con tono el vacío se
   * dice con palabras, sin icono: una línea con voz y, si la hay, una acción.
   */
  tono?: TonoVacio;
  /** Texto del catálogo `VOZ_VACIA` para esta lista; usa `tono` (belleza por defecto). */
  voz?: ClaveVacio;
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
  tono,
  voz,
  onLimpiarFiltros,
  labelLimpiarFiltros = "Limpiar filtros",
  className = "",
}: EmptyStateProps) {
  const sinResultados = variante === "sinResultados";
  const conVoz = !!tono || !!voz;
  const catalogo = voz ? textoVacio(voz, tono ?? "belleza") : null;
  const titulo = title ?? catalogo?.titulo ?? "";
  const descripcion = description ?? catalogo?.descripcion;
  // Con voz no hay icono por defecto: la frase hace el trabajo.
  const iconoMostrado = icon ?? (sinResultados && !conVoz ? <SearchX size={40} strokeWidth={1.5} /> : null);

  const accion =
    action ??
    (sinResultados && onLimpiarFiltros ? (
      <button
        type="button"
        onClick={onLimpiarFiltros}
        className="min-h-[44px] px-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors hover:border-slate-400 dark:hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
      >
        <X size={14} aria-hidden="true" />
        {labelLimpiarFiltros}
      </button>
    ) : null);

  return (
    <div
      data-tono={tono}
      className={`flex flex-col items-center justify-center text-center ${conVoz ? "py-12" : "py-14"} px-6 ${className}`}
    >
      {iconoMostrado && <div className="mb-3 text-slate-300 dark:text-slate-600">{iconoMostrado}</div>}
      <p className={conVoz ? "text-base font-medium text-foreground" : "font-medium text-slate-600 dark:text-slate-300"}>{titulo}</p>
      {descripcion && (
        <p className={`text-sm mt-1 max-w-xs ${conVoz ? "text-muted-foreground" : "text-slate-400 dark:text-slate-500"}`}>{descripcion}</p>
      )}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}
