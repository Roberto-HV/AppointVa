import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { adminApi } from "../../../../api/admin";
import EmptyState from "../../../../components/ui/EmptyState";
import ErrorCarga from "../../../../components/ui/ErrorCarga";
import Pagination from "../../../../components/ui/Pagination";
import { Skeleton } from "../../../../components/ui/Skeleton";
import { TAMANO_PAGINA } from "../../../../hooks/usePaginacionLocal";
import { formatFechaHoraCorta, formatFechaHoraExacta } from "../../../../utils/formatters";
import { SUPERFICIE } from "../estilos";

/**
 * Actividad del negocio (lote 4, G2 + I1): lo que los administradores le
 * hicieron, sacado del registro de auditoría con `negocioId`. Es la respuesta a
 * "¿quién me cambió el plan?" sin filtrar a mano el registro completo.
 */
export default function ActividadNegocio({ negocioId }: { negocioId: string }) {
  const [pagina, setPagina] = useState(1);

  // El mismo catálogo que la página de auditoría: etiquetas legibles.
  const { data: catalogo } = useQuery({
    queryKey: ["audit-catalogo"],
    queryFn: adminApi.obtenerCatalogoAuditoria,
    staleTime: Infinity,
  });
  const etiqueta = (accion: string) => catalogo?.acciones.find((a) => a.accion === accion)?.etiqueta ?? accion;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs-negocio", negocioId, pagina],
    queryFn: () => adminApi.obtenerAuditLogs({ negocioId, pagina, tamano: TAMANO_PAGINA }),
    placeholderData: (prev) => prev,
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.tamano)) : 1;

  if (isLoading) {
    return (
      <div role="status" aria-label="Cargando actividad" className={`${SUPERFICIE} divide-y divide-slate-100 dark:divide-slate-700`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError && !data) {
    return (
      <ErrorCarga
        className="py-8"
        mensaje="No se pudo cargar la actividad del negocio."
        onReintentar={() => refetch()}
        reintentando={isFetching}
      />
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className={SUPERFICIE}>
        <EmptyState
          icon={<History size={32} strokeWidth={1.5} />}
          title="Sin actividad registrada"
          description="Aquí verás cada cambio que un administrador haga en este negocio: plan, pagos, estado y ajustes."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol aria-label="Actividad del negocio" className={`${SUPERFICIE} divide-y divide-slate-100 dark:divide-slate-700`}>
        {data.datos.map((log) => (
          <li key={log.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{etiqueta(log.accion)}</p>
              <time
                dateTime={log.fechaEn}
                title={formatFechaHoraExacta(log.fechaEn)}
                className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap"
              >
                {formatFechaHoraCorta(log.fechaEn)}
              </time>
            </div>
            {log.detalles && (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">{log.detalles}</p>
            )}
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 break-all">
              Por {log.usuarioEmail ?? (log.usuarioId ? "un usuario sin correo" : "el sistema")}
            </p>
          </li>
        ))}
      </ol>
      {totalPaginas > 1 && (
        <div className={SUPERFICIE}>
          <Pagination
            pagina={pagina}
            totalPaginas={totalPaginas}
            total={data.total}
            labelTotal="eventos"
            onCambiar={setPagina}
            cargando={isFetching}
          />
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Solo los cambios de administración sobre este negocio.{" "}
        <Link to="/admin/audit" className="font-medium text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
          Ver el registro completo
        </Link>
      </p>
    </div>
  );
}
