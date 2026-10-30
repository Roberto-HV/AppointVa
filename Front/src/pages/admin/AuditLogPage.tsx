import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AuditLogDto } from "../../api/admin";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import { FiltroBarra } from "../../components/ui/filtros";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";
import { toUtcDate } from "../../utils/formatters";
import { rangoAuditoria } from "../../utils/fechas";
import { useTituloPagina } from "../../hooks/useTituloPagina";

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

/**
 * Nombre legible de cada acción (AP-24). El filtro sigue enviando el valor
 * interno; solo cambia lo que se muestra.
 */
const ETIQUETA_ACCION: Record<string, string> = {
  Login: "Inicio de sesión",
  LoginFallido: "Inicio de sesión fallido",
  Logout: "Cierre de sesión",
  CambiarPassword: "Cambio de contraseña",
  EliminarCuenta: "Eliminación de cuenta",
};

const etiquetaAccion = (accion: string) => ETIQUETA_ACCION[accion] ?? accion;

/** Un UUID completo se busca como `usuarioId`; cualquier otro texto, como parte del correo (B24). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AuditLogPage() {
  useTituloPagina("Registro de auditoría · Admin");
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState("");
  // Correo (o parte de él) o el ID completo de un usuario.
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // Fila con los detalles completos abierta. Antes solo se leían en `title`
  // (hover), que en una pantalla táctil no existe.
  const [abierto, setAbierto] = useState<string | null>(null);

  const usuarioId = UUID.test(busqueda) ? busqueda : "";
  const email = busqueda && !usuarioId ? busqueda : "";
  const rango = rangoAuditoria(desde, hasta);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", pagina, accion, usuarioId, email, rango.desde, rango.hasta],
    queryFn: () => adminApi.obtenerAuditLogs({
      pagina,
      tamano: TAMANO_PAGINA,
      accion: accion || undefined,
      usuarioId: usuarioId || undefined,
      email: email || undefined,
      desde: rango.desde,
      hasta: rango.hasta,
    }),
    placeholderData: (prev) => prev,
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.tamano)) : 1;
  const hayFiltros = Boolean(accion || busqueda || desde || hasta);

  const limpiarFiltros = () => {
    setAccion("");
    setBusqueda("");
    setDesde("");
    setHasta("");
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
    if (a === "Logout") return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
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
          valor: busqueda,
          // La barra aplica la búsqueda al dejar de teclear (o con Enter), no
          // en cada tecla: así no se dispara una consulta por carácter.
          onChange: (v) => { setBusqueda(v.trim()); setPagina(1); },
          etiqueta: "Buscar por correo o ID de usuario",
          placeholder: "Correo o ID de usuario",
        }}
        campos={[
          {
            id: "accion",
            tipo: "select",
            etiqueta: "Acción",
            valor: accion,
            onChange: (v) => { setAccion(v); setPagina(1); },
            etiquetaNeutra: "Todas las acciones",
            opciones: ACCIONES.map((a) => ({ valor: a, etiqueta: etiquetaAccion(a) })),
          },
          {
            id: "periodo",
            tipo: "rangoFechas",
            etiqueta: "Período",
            desde,
            hasta,
            onChange: (d, h) => { setDesde(d); setHasta(h && d && h < d ? d : h); setPagina(1); },
          },
        ]}
        onLimpiar={limpiarFiltros}
      />


      {/* Tabla */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Entidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Detalles</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando…</td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="text-sm text-red-600 dark:text-red-400">No se pudo cargar el registro.</p>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="mt-3 min-h-[44px] lg:min-h-[36px] px-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
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
              {!isError && data?.datos.map((log: AuditLogDto) => {
                const expandido = abierto === log.id;
                const idDetalle = `detalle-${log.id}`;
                return (
                  <Fragment key={log.id}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {formatFecha(log.fechaEn)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badgeColor(log.accion)}`}>
                          {etiquetaAccion(log.accion)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
                        <div className="truncate max-w-[180px]">
                          {log.usuarioEmail ?? <span className="text-slate-500 dark:text-slate-400">{log.usuarioId ? "Usuario sin correo" : "—"}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {log.entidad ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[160px] truncate">{log.detalles ?? "—"}</span>
                          <button
                            type="button"
                            onClick={() => setAbierto(expandido ? null : log.id)}
                            aria-expanded={expandido}
                            aria-controls={idDetalle}
                            className="inline-flex items-center gap-1 min-h-[44px] lg:min-h-[36px] px-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
                          >
                            {expandido ? "Ocultar" : "Ver detalle"}
                            <ChevronDown size={14} aria-hidden="true" className={expandido ? "rotate-180" : ""} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">{log.ipAddress ?? "—"}</td>
                    </tr>
                    {expandido && (
                      <tr id={idDetalle} className="bg-slate-50 dark:bg-slate-800/60">
                        <td colSpan={6} className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
                          <dl className="grid sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
                            <dt className="font-semibold text-slate-500 dark:text-slate-400">Detalles</dt>
                            <dd className="whitespace-pre-wrap break-words">{log.detalles ?? "—"}</dd>
                            <dt className="font-semibold text-slate-500 dark:text-slate-400">ID de usuario</dt>
                            <dd className="font-mono break-all">{log.usuarioId ?? "—"}</dd>
                            {log.entidad && (
                              <>
                                <dt className="font-semibold text-slate-500 dark:text-slate-400">Entidad</dt>
                                <dd className="font-mono break-all">{log.entidad}{log.entidadId ? ` · ${log.entidadId}` : ""}</dd>
                              </>
                            )}
                          </dl>
                          {log.usuarioId && log.usuarioId !== usuarioId && (
                            <button
                              type="button"
                              onClick={() => { setBusqueda(log.usuarioId!); setPagina(1); setAbierto(null); }}
                              className="mt-3 min-h-[44px] lg:min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-600 font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
                            >
                              Ver solo los eventos de este usuario
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
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
