import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AuditLogDto, type CatalogoAuditoria } from "../../api/admin";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import EmptyState from "../../components/ui/EmptyState";
import ErrorCarga from "../../components/ui/ErrorCarga";
import Pagination from "../../components/ui/Pagination";
import { SkeletonLista } from "../../components/ui/Skeleton";
import { FiltroBarra } from "../../components/ui/filtros";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { formatFechaHoraCorta, formatFechaHoraExacta } from "../../utils/formatters";
import { rangoAuditoria } from "../../utils/fechas";
import { useTituloPagina } from "../../hooks/useTituloPagina";

/**
 * Las acciones del filtro y sus nombres legibles (AP-24) vienen del catálogo
 * del backend (`GET /api/admin/audit/acciones`, `AccionesAuditoria`). Antes
 * había aquí una lista a mano de 5 acciones que se quedó atrás: el backend ya
 * escribía 2FA, kiosco y exportaciones que no se podían filtrar y salían con el
 * nombre interno. Una prueba del backend exige que toda acción escrita esté en
 * el catálogo, así que esta página ya no tiene que seguirle el paso.
 */
const GRUPO_ADMINISTRACION = "administracion";

/** Mientras llega el catálogo (o si falla), se muestra el valor interno. */
const etiquetaDe = (catalogo: CatalogoAuditoria | undefined, accion: string) =>
  catalogo?.acciones.find((a) => a.accion === accion)?.etiqueta ?? accion;

const grupoDe = (catalogo: CatalogoAuditoria | undefined, accion: string) =>
  catalogo?.acciones.find((a) => a.accion === accion)?.grupo;

/** Un UUID completo se busca como `usuarioId`; cualquier otro texto, como parte del correo (B24). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La IP del propio equipo (`::1`, `127.0.0.1`) no dice nada en la fila (M8):
 * se lee "Local" y la dirección exacta queda en el detalle.
 */
const IP_LOCAL = new Set(["::1", "127.0.0.1", "::ffff:127.0.0.1"]);
const ipLegible = (ip: string | null) => (ip ? (IP_LOCAL.has(ip) ? "Local" : ip) : "—");

const TH = "text-left px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide";
const BOTON_DETALLE =
  "inline-flex items-center gap-1 min-h-[44px] lg:min-h-[32px] px-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 " +
  "hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40";

export default function AuditLogPage() {
  useTituloPagina("Registro de auditoría · Admin");
  const [pagina, setPagina] = useState(1);
  const [accion, setAccion] = useState("");
  // Grupo del catálogo ("Acciones de administración", "Inicios de sesión"…).
  const [grupo, setGrupo] = useState("");
  // Correo (o parte de él) o el ID completo de un usuario.
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  // Fila con los detalles completos abierta. Antes solo se leían en `title`
  // (hover), que en una pantalla táctil no existe.
  const [abierto, setAbierto] = useState<string | null>(null);
  // Debajo de `sm` cada evento es una tarjeta (I6): en la tabla, a 390px la
  // columna Usuario salía cortada y había que desplazarse de lado.
  const esMovil = useMediaQuery(CONSULTA_MOVIL);

  const usuarioId = UUID.test(busqueda) ? busqueda : "";
  const email = busqueda && !usuarioId ? busqueda : "";
  const rango = rangoAuditoria(desde, hasta);

  // El catálogo no cambia mientras corre el API: se pide una vez por sesión.
  const { data: catalogo } = useQuery({
    queryKey: ["audit-catalogo"],
    queryFn: adminApi.obtenerCatalogoAuditoria,
    staleTime: Infinity,
  });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", pagina, accion, grupo, usuarioId, email, rango.desde, rango.hasta],
    queryFn: () => adminApi.obtenerAuditLogs({
      pagina,
      tamano: TAMANO_PAGINA,
      accion: accion || undefined,
      grupo: grupo || undefined,
      usuarioId: usuarioId || undefined,
      email: email || undefined,
      desde: rango.desde,
      hasta: rango.hasta,
    }),
    placeholderData: (prev) => prev,
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.tamano)) : 1;
  const hayFiltros = Boolean(accion || grupo || busqueda || desde || hasta);
  const etiquetaAccion = (a: string) => etiquetaDe(catalogo, a);
  // Con un tipo elegido, "Acción" solo ofrece las de ese tipo.
  const accionesDelFiltro = (catalogo?.acciones ?? []).filter((a) => !grupo || a.grupo === grupo);

  const cambiarGrupo = (g: string) => {
    setGrupo(g);
    if (accion && g && grupoDe(catalogo, accion) !== g) setAccion("");
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setAccion("");
    setGrupo("");
    setBusqueda("");
    setDesde("");
    setHasta("");
    setPagina(1);
  };

  const verSoloUsuario = (id: string) => {
    setBusqueda(id);
    setPagina(1);
    setAbierto(null);
  };

  const badgeColor = (a: string) => {
    if (/Fallid|Elimin|Bloquead/.test(a)) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (a === "Login") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (a === "Logout") return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
    // Mismo tono que el chip "Super Admin": se distinguen de un vistazo.
    if (grupoDe(catalogo, a) === GRUPO_ADMINISTRACION) return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  };

  const badge = (a: string) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badgeColor(a)}`}>
      {etiquetaAccion(a)}
    </span>
  );

  const usuarioDe = (log: AuditLogDto) =>
    log.usuarioEmail ?? <span className="text-slate-500 dark:text-slate-400">{log.usuarioId ? "Usuario sin correo" : "—"}</span>;

  /** A quién afecta el evento: el negocio por su nombre; si ya no existe, se dice. */
  const afectado = (log: AuditLogDto) => {
    if (log.negocioNombre) return log.negocioNombre;
    if (log.entidad === "Negocio") return "Negocio que ya no existe";
    return log.entidad ?? "—";
  };

  const botonDetalle = (log: AuditLogDto, expandido: boolean) => (
    <button
      type="button"
      onClick={() => setAbierto(expandido ? null : log.id)}
      aria-expanded={expandido}
      aria-controls={`detalle-${log.id}`}
      className={BOTON_DETALLE}
    >
      {expandido ? "Ocultar" : "Ver detalle"}
      <ChevronDown size={14} aria-hidden="true" className={expandido ? "rotate-180" : ""} />
    </button>
  );

  /** Lo que no cabe en la fila: detalles completos, fecha exacta, IDs e IP. */
  const detalleEvento = (log: AuditLogDto) => (
    <>
      <dl className="grid sm:grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Fecha exacta</dt>
        <dd className="tabular-nums">{formatFechaHoraExacta(log.fechaEn)}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">Detalles</dt>
        <dd className="whitespace-pre-wrap break-words">{log.detalles ?? "—"}</dd>
        <dt className="font-semibold text-slate-500 dark:text-slate-400">ID de usuario</dt>
        <dd className="font-mono break-all">{log.usuarioId ?? "—"}</dd>
        {log.negocioNombre && (
          <>
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Negocio</dt>
            <dd className="break-words">{log.negocioNombre}</dd>
          </>
        )}
        {log.entidad && (
          <>
            <dt className="font-semibold text-slate-500 dark:text-slate-400">Entidad</dt>
            <dd className="font-mono break-all">{log.entidad}{log.entidadId ? ` · ${log.entidadId}` : ""}</dd>
          </>
        )}
        <dt className="font-semibold text-slate-500 dark:text-slate-400">IP</dt>
        <dd className="font-mono break-all">{log.ipAddress ?? "—"}</dd>
      </dl>
      {log.usuarioId && log.usuarioId !== usuarioId && (
        <button
          type="button"
          onClick={() => verSoloUsuario(log.usuarioId!)}
          className="mt-3 min-h-[44px] lg:min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-600 font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
        >
          Ver solo los eventos de este usuario
        </button>
      )}
    </>
  );

  const vacio = hayFiltros ? (
    <EmptyState
      variante="sinResultados"
      title="Sin registros"
      description="Ningún evento coincide con los filtros actuales."
      onLimpiarFiltros={limpiarFiltros}
      // Distinto del "Limpiar filtros" de la barra: dos botones con el mismo
      // nombre accesible en la misma pantalla no se distinguen al navegar por lista.
      labelLimpiarFiltros="Ver todos los eventos"
    />
  ) : (
    <EmptyState title="Sin registros" description="Todavía no hay eventos auditados." />
  );

  const eventos = data?.datos ?? [];

  const paginacion = (
    <Pagination
      pagina={pagina}
      totalPaginas={totalPaginas}
      total={data?.total ?? 0}
      labelTotal="eventos"
      onCambiar={setPagina}
      cargando={isLoading}
    />
  );

  let contenido;
  if (isLoading) {
    // Skeleton con la forma de la lista real (I5): antes era "Cargando…" en una fila.
    contenido = <SkeletonLista filas={8} columnas={6} etiqueta="Cargando registro de auditoría" />;
  } else if (isError) {
    contenido = (
      <ErrorCarga
        mensaje="No se pudo cargar el registro de auditoría."
        onReintentar={() => refetch()}
        reintentando={isFetching}
      />
    );
  } else if (esMovil) {
    contenido = (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        {eventos.length === 0 ? vacio : (
          <ul aria-label="Eventos" className="divide-y divide-slate-100 dark:divide-slate-700">
            {eventos.map((log) => {
              const expandido = abierto === log.id;
              return (
                <li key={log.id} className="px-4 py-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    {badge(log.accion)}
                    <span className="text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{formatFechaHoraCorta(log.fechaEn)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 break-all">{usuarioDe(log)}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-3">
                    <p className="min-w-0 text-slate-500 dark:text-slate-400 truncate">
                      Afecta a: <span className="text-slate-700 dark:text-slate-200">{afectado(log)}</span>
                    </p>
                    <div className="-mr-2 shrink-0">{botonDetalle(log, expandido)}</div>
                  </div>
                  {expandido && (
                    <div id={`detalle-${log.id}`} className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-slate-700 dark:text-slate-200">
                      {detalleEvento(log)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {paginacion}
      </div>
    );
  } else {
    contenido = (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
              <tr>
                <th className={`${TH} whitespace-nowrap`}>Fecha</th>
                <th className={TH}>Acción</th>
                <th className={TH}>Usuario</th>
                <th className={TH}>Afecta a</th>
                <th className={TH}>Detalles</th>
                <th className={TH}>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {eventos.length === 0 && (
                <tr>
                  <td colSpan={6}>{vacio}</td>
                </tr>
              )}
              {eventos.map((log) => {
                const expandido = abierto === log.id;
                return (
                  <Fragment key={log.id}>
                    {/* Filas de unos 40px en escritorio (M8): antes medían 60. */}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {formatFechaHoraCorta(log.fechaEn)}
                      </td>
                      <td className="px-4 py-1.5">{badge(log.accion)}</td>
                      <td className="px-4 py-1.5 text-xs text-slate-700 dark:text-slate-200">
                        <div className="truncate max-w-[220px]">{usuarioDe(log)}</div>
                      </td>
                      <td className="px-4 py-1.5 text-xs text-slate-700 dark:text-slate-200">
                        <div className="truncate max-w-[180px]">{afectado(log)}</div>
                      </td>
                      <td className="px-4 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[160px] truncate">{log.detalles ?? "—"}</span>
                          {botonDetalle(log, expandido)}
                        </div>
                      </td>
                      <td
                        title={log.ipAddress ?? undefined}
                        className={`px-4 py-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap ${ipLegible(log.ipAddress) === log.ipAddress ? "font-mono" : ""}`}
                      >
                        {ipLegible(log.ipAddress)}
                      </td>
                    </tr>
                    {expandido && (
                      <tr id={`detalle-${log.id}`} className="bg-slate-50 dark:bg-slate-800/60">
                        <td colSpan={6} className="px-4 py-3 text-xs text-slate-700 dark:text-slate-200">
                          {detalleEvento(log)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {paginacion}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-5"
        titulo="Registro de auditoría"
        subtitulo={
          data
            ? `${data.total} ${data.total === 1 ? "evento registrado" : "eventos registrados"} en total`
            : "Accesos, cambios de cuenta y acciones de administración"
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
            id: "grupo",
            tipo: "select",
            etiqueta: "Tipo",
            valor: grupo,
            onChange: cambiarGrupo,
            etiquetaNeutra: "Todos los tipos",
            opciones: (catalogo?.grupos ?? []).map((g) => ({ valor: g.id, etiqueta: g.etiqueta })),
          },
          {
            id: "accion",
            tipo: "select",
            etiqueta: "Acción",
            valor: accion,
            onChange: (v) => { setAccion(v); setPagina(1); },
            etiquetaNeutra: "Todas las acciones",
            opciones: accionesDelFiltro.map((a) => ({ valor: a.accion, etiqueta: a.etiqueta })),
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

      {contenido}
    </div>
  );
}
