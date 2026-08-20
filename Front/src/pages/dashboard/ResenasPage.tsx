import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { meApi } from "../../api/me";
import { formatFecha } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import { Star } from "lucide-react";

const PAGE_SIZE = 20;

function formatearNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`;
}

function Estrellas({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200 dark:text-slate-600"}
        />
      ))}
    </div>
  );
}

export default function ResenasPage() {
  const [pagina, setPagina] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["resenas", pagina],
    queryFn: () => meApi.obtenerResenas(pagina, PAGE_SIZE),
  });

  const resenas = data?.items.filter((r) => r.aprobada) ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const promedioNumerico =
    resenas.length > 0
      ? resenas.reduce((acc, r) => acc + r.rating, 0) / resenas.length
      : null;
  const promedioRating = promedioNumerico !== null && promedioNumerico > 0
    ? promedioNumerico.toFixed(1)
    : null;

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reseñas</h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {total} reseña{total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        {promedioRating && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-2">
            <Star size={18} className="text-amber-400 fill-amber-400 shrink-0" />
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{promedioRating}</span>
            <span className="text-xs text-amber-500 dark:text-amber-500">/ 5</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : resenas.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center">
          <div className="flex justify-center mb-4">
            <Star size={36} className="text-gray-200 dark:text-slate-600" />
          </div>
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Aún no tienes reseñas</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Las reseñas aparecerán aquí cuando tus clientes las dejen
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{total} reseña{total !== 1 ? "s" : ""} aprobada{total !== 1 ? "s" : ""}</p>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Calificación</th>
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Comentario</th>
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {resenas.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                    <td className="px-5 py-3">
                      <Estrellas rating={r.rating} />
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{formatearNombre(r.nombreCliente)}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400 max-w-xs">
                      {r.comentario
                        ? r.comentario.length > 100
                          ? `${r.comentario.slice(0, 100)}…`
                          : r.comentario
                        : <span className="text-gray-300 dark:text-slate-600 italic text-xs">Sin comentario</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatFecha(r.fechaCreacion)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={total}
              labelTotal="reseñas"
              onCambiar={setPagina}
              cargando={isLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
