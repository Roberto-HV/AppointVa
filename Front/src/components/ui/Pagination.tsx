interface PaginationProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  labelTotal: string;
  onCambiar: (p: number) => void;
  cargando?: boolean;
}

export default function Pagination({ pagina, totalPaginas, total, labelTotal, onCambiar, cargando }: PaginationProps) {
  if (totalPaginas <= 1) return null;

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
          className="min-h-[44px] lg:min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
        >
          ← Anterior
        </button>
        {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
          const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
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
          className="min-h-[44px] lg:min-h-[36px] px-3 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
        >
          Siguiente →
        </button>
      </div>
    </nav>
  );
}
