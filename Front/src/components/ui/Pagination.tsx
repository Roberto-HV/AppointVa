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
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-500">
      <span>{total} {labelTotal} · página {pagina} de {totalPaginas}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onCambiar(Math.max(1, pagina - 1))}
          disabled={pagina === 1 || cargando}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
        >
          ← Anterior
        </button>
        {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
          const inicio = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
          const num = inicio + i;
          return num <= totalPaginas ? (
            <button
              key={num}
              onClick={() => onCambiar(num)}
              disabled={cargando}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition ${
                num === pagina ? "bg-primary text-white" : "border border-gray-200 hover:bg-gray-50 text-gray-600"
              }`}
            >
              {num}
            </button>
          ) : null;
        })}
        <button
          onClick={() => onCambiar(Math.min(totalPaginas, pagina + 1))}
          disabled={pagina === totalPaginas || cargando}
          className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs font-medium"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
