import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AuditLogDto } from "../../api/admin";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { FiltroBarra } from "../../components/ui/filtros";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";
import { toUtcDate } from "../../utils/formatters";

/**
 * Acciones que `AuditService` llega a escribir.
 *
 * La lista traía además "SubirFoto", que es el nombre de dos endpoints pero
 * nunca un valor de `AuditLog.Accion`: filtrar por ella devolvía siempre cero
 * registros sin decir por qué. Esta lista debe seguir a las llamadas de
 * `RegistrarAsync` del backend; si se agrega una acción allá, va aquí.
 */
const ACCIONES = [
  "Login",
  "LoginFallido",
  "Logout",
  "CambiarPassword",
  "EliminarCuenta",
];

/** El backend recibe `usuarioId` como `Guid?`: cualquier otra cosa es un 400. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditLogPage() {
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState("");
  const [usuarioId, setUsuarioId] = useState("");

  const usuarioIdValido = usuarioId === "" || UUID.test(usuarioId);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", pagina, accion, usuarioId],
    queryFn: () => adminApi.obtenerAuditLogs({
      pagina,
      tamano: TAMANO_PAGINA,
      accion: accion || undefined,
      usuarioId: usuarioId || undefined,
    }),
    // Un UUID a medio teclear hacía que la API respondiera 400 y la tabla se
    // quedara en blanco, sin filas, sin "Sin registros" y sin error: `data`
    // era `undefined` y ninguna de las dos ramas se cumplía. Ahora la consulta
    // ni se lanza y el aviso sale junto al campo.
    enabled: usuarioIdValido,
    placeholderData: (prev) => prev,
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.tamano)) : 1;
  const hayFiltros = Boolean(accion || usuarioId);

  const limpiarFiltros = () => {
    setAccion("");
    setUsuarioId("");
    setPagina(1);
  };

  const formatFecha = (iso: string) => {
    const d = toUtcDate(iso);
    return d.toLocaleString("es-MX", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "numeric", minute: "2-digit", second: "2-digit",
      hour12: true,
    });
  };

  const badgeColor = (a: string) => {
    if (a.includes("Fallido") || a.includes("Eliminar")) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (a === "Login") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (a === "Logout") return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  const sinRegistros = !isLoading && !isError && data?.datos.length === 0;

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-5"
        titulo="Registro de auditoría"
        subtitulo={
          data
            ? `${data.total} ${data.total === 1 ? "evento registrado" : "eventos registrados"} en total`
            : "Accesos y cambios sensibles de la cuenta"
        }
      />

      <FiltroBarra
        etiqueta="Filtros del registro de auditoría"
        busqueda={{
          valor: usuarioId,
          // La búsqueda se confirma con "Buscar" o Enter, no al teclear: así el
          // UUID viaja completo y no se dispara una consulta por carácter.
          onChange: (v) => { setUsuarioId(v.trim()); setPagina(1); },
          etiqueta: "Buscar por ID de usuario",
          placeholder: "ID de usuario (UUID)",
        }}
        campos={[
          {
            id: "accion",
            tipo: "select",
            etiqueta: "Acción",
            valor: accion,
            onChange: (v) => { setAccion(v); setPagina(1); },
            etiquetaNeutra: "Todas las acciones",
            opciones: ACCIONES.map((a) => ({ valor: a, etiqueta: a })),
          },
        ]}
        onLimpiar={limpiarFiltros}
      />

      {!usuarioIdValido && (
        <p role="alert" className="-mt-3 mb-5 text-sm text-red-600 dark:text-red-400">
          El ID de usuario debe ser un UUID completo.
        </p>
      )}

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Entidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Detalles</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">Cargando…</td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="text-sm text-red-600 dark:text-red-400">No se pudo cargar el registro.</p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="mt-3 min-h-[44px] lg:min-h-[36px] px-4 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40"
                    >
                      Reintentar
                    </button>
                  </td>
                </tr>
              )}
              {sinRegistros && (
                <tr>
                  <td colSpan={6}>
                    {hayFiltros ? (
                      <EmptyState
                        variante="sinResultados"
                        title="Sin registros"
                        description="Ningún evento coincide con los filtros actuales."
                        onLimpiarFiltros={limpiarFiltros}
                        // Distinto del "Limpiar filtros" de la barra: dos
                        // botones con el mismo nombre accesible en la misma
                        // pantalla no se distinguen al navegar por lista.
                        labelLimpiarFiltros="Ver todos los eventos"
                      />
                    ) : (
                      <EmptyState title="Sin registros" description="Todavía no hay eventos auditados." />
                    )}
                  </td>
                </tr>
              )}
              {!isError && data?.datos.map((log: AuditLogDto) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                    {formatFecha(log.fechaEn)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badgeColor(log.accion)}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 dark:text-slate-200">
                    <div className="truncate max-w-[180px]" title={log.usuarioEmail ?? log.usuarioId ?? ""}>
                      {log.usuarioEmail ?? <span className="text-gray-400 dark:text-slate-500">{log.usuarioId?.slice(0, 8) ?? "—"}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                    {log.entidad ? `${log.entidad}${log.entidadId ? ` (${log.entidadId.slice(0, 8)})` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400 max-w-[200px] truncate" title={log.detalles ?? ""}>
                    {log.detalles ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500 font-mono">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={data?.total ?? 0}
          labelTotal="eventos"
          onCambiar={setPagina}
          cargando={isLoading}
        />
      </div>
    </div>
  );
}
