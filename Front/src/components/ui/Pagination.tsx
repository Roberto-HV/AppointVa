import { useEffect, useState } from "react";

interface PaginationProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  labelTotal: string;
  onCambiar: (p: number) => void;
  cargando?: boolean;
}

export default function Pagination({ pagina, totalPaginas, total, labelTotal, onCambiar, cargando }: PaginationProps) {
  // A 15 filas por página una lista normal llega a decenas de páginas. Con cinco
  // botones numerados de 44px más "Anterior" y "Siguiente" la fila mide ~440px y
  // desborda la pantalla de 390px, así que ahí la ventana baja a tres y los dos
  // botones de salto se quedan solo con la flecha (el nombre sigue en el
  // `aria-label`). No es CSS porque la ventana se centra en la página actual:
  // ocultar el primero y el último dejaría fuera la página 1.
  const [ventana, setVentana] = useState(() =>
    typeof window === "undefined" || window.innerWidth >= 640 ? 5 : 3
  );
  useEffect(() => {
    const alCambiar = () => setVentana(window.innerWidth >= 640 ? 5 : 3);
    alCambiar();
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);

  if (totalPaginas <= 1) return null;

  const visibles = Math.min(ventana, totalPaginas);

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-gray-100 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400"
    >
      <span>{total} {labelTotal} · página {pagina} de {totalPaginas}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onCambiar(Math.max(1, pagina - 1))}
          disabled={pagina === 1 || cargando}
          aria-label="Página anterior"
          className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
        >
          ←<span className="hidden sm:inline"> Anterior</span>
        </button>
        {Array.from({ length: visibles }, (_, i) => {
          const inicio = Math.max(1, Math.min(pagina - Math.floor(visibles / 2), totalPaginas - visibles + 1));
          const num = inicio + i;
          return num <= totalPaginas ? (
            <button
              key={num}
              type="button"
              onClick={() => onCambiar(num)}
              disabled={cargando}
              aria-label={`Página ${num}`}
              aria-current={num === pagina ? "page" : undefined}
              className={`min-w-[44px] min-h-[44px] lg:min-w-[36px] lg:min-h-[36px] rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40 ${
                num === pagina
                  ? "bg-slate-700 text-white dark:bg-slate-600"
                  : "border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              {num}
            </button>
          ) : null;
        })}
        <button
          type="button"
          onClick={() => onCambiar(Math.min(totalPaginas, pagina + 1))}
          disabled={pagina === totalPaginas || cargando}
          aria-label="Página siguiente"
          className="min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
        >
          <span className="hidden sm:inline">Siguiente </span>→
        </button>
      </div>
    </nav>
  );
}
