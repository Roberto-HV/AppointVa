import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AuditLogDto } from "../../api/admin";

const ACCIONES = [
  "Login", "LoginFallido", "Logout", "CambiarPassword",
  "EliminarCuenta", "SubirFoto",
];

export default function AuditLogPage() {
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState("");
  const [usuarioId, setUsuarioId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", pagina, accion, usuarioId],
    queryFn: () => adminApi.obtenerAuditLogs({
      pagina,
      tamano: 50,
      accion: accion || undefined,
      usuarioId: usuarioId || undefined,
    }),
  });

  const totalPaginas = data ? Math.ceil(data.total / data.tamano) : 1;

  const formatFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-MX", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
  };

  const badgeColor = (a: string) => {
    if (a.includes("Fallido") || a.includes("Eliminar")) return "bg-red-100 text-red-700";
    if (a === "Login") return "bg-emerald-100 text-emerald-700";
    if (a === "Logout") return "bg-gray-100 text-gray-600";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Audit Log</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={accion}
          onChange={(e) => { setAccion(e.target.value); setPagina(1); }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-gray-400"
        >
          <option value="">Todas las acciones</option>
          {ACCIONES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          placeholder="ID de usuario (UUID)"
          value={usuarioId}
          onChange={(e) => { setUsuarioId(e.target.value.trim()); setPagina(1); }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 w-72"
        />
        {(accion || usuarioId) && (
          <button
            onClick={() => { setAccion(""); setUsuarioId(""); setPagina(1); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Cargando…</td>
                </tr>
              )}
              {!isLoading && data?.datos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Sin registros</td>
                </tr>
              )}
              {data?.datos.map((log: AuditLogDto) => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-variant-numeric tabular-nums">
                    {formatFecha(log.fechaEn)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor(log.accion)}`}>
                      {log.accion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    <div className="truncate max-w-[180px]" title={log.usuarioEmail ?? log.usuarioId ?? ""}>
                      {log.usuarioEmail ?? <span className="text-gray-400">{log.usuarioId?.slice(0, 8) ?? "—"}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {log.entidad ? `${log.entidad}${log.entidadId ? ` (${log.entidadId.slice(0, 8)})` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={log.detalles ?? ""}>
                    {log.detalles ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {data && data.total > data.tamano && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">{data.total} registros totales</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-500">{pagina} / {totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
