import { useId } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../../../lib/utils";

interface FiltroBusquedaProps {
  valor: string;
  onChange: (valor: string) => void;
  /** Etiqueta accesible; se muestra solo a lectores de pantalla. */
  etiqueta?: string;
  placeholder?: string;
  /**
   * Solo para las búsquedas que se confirman en vez de filtrar al teclear:
   * se dispara con Enter. Sin esto el campo filtra con cada cambio.
   */
  onSubmit?: () => void;
  className?: string;
}

/**
 * Campo de búsqueda de la barra de filtros.
 *
 * El tamaño de fuente es `text-base` (16px) hasta `lg`: Safari en iOS hace zoom
 * sobre cualquier input enfocado con fuente menor a 16px, y varias páginas lo
 * disparaban con `text-xs`. En escritorio sí baja a 14px.
 */
export default function FiltroBusqueda({
  valor,
  onChange,
  etiqueta = "Buscar",
  placeholder = "Buscar...",
  onSubmit,
  className,
}: FiltroBusquedaProps) {
  const id = useId();

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      <Search
        size={16}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none"
      />
      <input
        id={id}
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onSubmit && ((e) => { if (e.key === "Enter") onSubmit(); })}
        placeholder={placeholder}
        className={cn(
          "w-full min-h-[44px] pl-9 pr-9 py-2 rounded-xl border shadow-sm transition-colors",
          "text-base lg:text-sm",
          "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100",
          "border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500",
          "placeholder:text-gray-400 dark:placeholder:text-slate-500",
          "focus:outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/20",
          "dark:focus:border-slate-400 dark:focus:ring-slate-400/20",
          // Safari dibuja su propia X en `type=search`; usamos la nuestra.
          "[&::-webkit-search-cancel-button]:appearance-none"
        )}
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Borrar ${etiqueta.toLowerCase()}`}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px]",
            "flex items-center justify-center rounded-lg transition-colors",
            "text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40"
          )}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
