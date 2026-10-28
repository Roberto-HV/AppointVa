import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { meApi } from "../../api/me";
import { formatFecha } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { Star } from "lucide-react";
import ErrorCarga from "../../components/ui/ErrorCarga";

import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";

const PAGE_SIZE = TAMANO_PAGINA;
const LIMITE_COMENTARIO = 100;

function formatearNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`;
}

function Estrellas({ rating }: { rating: number }) {
  // Una imagen con nombre: los lectores de pantalla no oían ninguna calificación.
  return (
    <div role="img" aria-label={`${rating} de 5 estrellas`} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          aria-hidden="true"
          className={n <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200 dark:text-slate-600"}
        />
      ))}
    </div>
  );
}

/** Comentario largo con "Ver más" en el mismo sitio: antes se cortaba a 100 caracteres sin forma de leerlo. */
function Comentario({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  if (texto.length <= LIMITE_COMENTARIO) return <>{texto}</>;
  return (
    <>
      {abierto ? texto : `${texto.slice(0, LIMITE_COMENTARIO)}…`}{" "}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="text-xs font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {abierto ? "Ver menos" : "Ver más"}
      </button>
    </>
  );
}

/** Barras 5→1 con cuántas reseñas aprobadas tiene cada calificación (B15). */
function Distribucion({ distribucion, total }: { distribucion: Record<string, number>; total: number }) {
  return (
    <ul aria-label="Reseñas por calificación" className="tarjeta p-4 mb-4 space-y-1.5 max-w-md">
      {[5, 4, 3, 2, 1].map((n) => {
        const cantidad = distribucion[String(n)] ?? 0;
        const porcentaje = total > 0 ? Math.round((cantidad / total) * 100) : 0;
        return (
          <li key={n} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="w-16 shrink-0 tabular-nums">{n} estrella{n !== 1 ? "s" : ""}</span>
            <span aria-hidden="true" className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <span className="block h-full rounded-full bg-amber-400" style={{ width: `${porcentaje}%` }} />
            </span>
            <span className="w-8 shrink-0 text-right tabular-nums">{cantidad}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ResenasPage() {
  const [pagina, setPagina] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["resenas", pagina],
    queryFn: () => meApi.obtenerResenas(pagina, PAGE_SIZE),
  });

  // El servidor solo manda reseñas aprobadas y calcula el total, el promedio y
  // la distribución sobre todas ellas, no sobre esta página (B15, decisión 15).
  const resenas = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const promedioRating = data?.promedio != null && data.promedio > 0 ? data.promedio.toFixed(1) : null;

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo="Reseñas"
        subtitulo={
          <>
            Opiniones que dejan tus clientes al terminar su cita
            {!isLoading && (
              <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                ({total} reseña{total !== 1 ? "s" : ""})
              </span>
            )}
          </>
        }
        /* Va por `complemento` y no por `acciones`: el ámbar aquí es el color de
           la calificación, el mismo de las estrellas, y lo que muestra es un
           dato, no algo que se pueda pulsar. Se queda en el hueco de la derecha
           porque describe la página entera, igual que el título. */
        complemento={
          promedioRating && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl px-4 py-2">
              <Star size={18} className="text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{promedioRating}</span>
              <span className="text-xs text-amber-500 dark:text-amber-500">/ 5</span>
              <span className="text-[11px] leading-tight text-amber-600/80 dark:text-amber-400/80 max-w-[5.5rem]">
                promedio de todas
              </span>
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ErrorCarga mensaje="No se pudieron cargar las reseñas." onReintentar={() => refetch()} reintentando={isFetching} />
      ) : total === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-12 text-center">
          <div className="flex justify-center mb-4">
            <Star size={36} className="text-slate-200 dark:text-slate-600" />
          </div>
          <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Aún no tienes reseñas</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Las reseñas aparecerán aquí cuando tus clientes las dejen
          </p>
        </div>
      ) : (
        <>
          {data?.distribucion && <Distribucion distribucion={data.distribucion} total={total} />}
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{total} reseña{total !== 1 ? "s" : ""} publicada{total !== 1 ? "s" : ""}</p>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Calificación</th>
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Comentario</th>
                  <th className="text-left px-5 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {resenas.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td className="px-5 py-3">
                      <Estrellas rating={r.rating} />
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatearNombre(r.nombreCliente)}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 max-w-xs">
                      {r.comentario
                        ? <Comentario texto={r.comentario} />
                        : <span className="text-slate-300 dark:text-slate-600 italic text-xs">Sin comentario</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
