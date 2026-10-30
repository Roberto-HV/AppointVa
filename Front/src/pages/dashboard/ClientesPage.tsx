import { useState, useEffect, useMemo, useId } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientesApi } from "../../api/clientes";
import { negociosApi } from "../../api/negocios";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import Modal from "../../components/ui/Modal";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { exportarExcel } from "../../utils/exportarExcel";
import { mensajeError } from "../../utils/errores";
import { soloFecha } from "../../utils/fechas";
import type { ClienteDto } from "../../types";
import { formatPrecio, formatFecha, formatFechaCorta, formatFechaHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import { useToastStore } from "../../store/toastStore";
import { SiWhatsapp } from "react-icons/si";
import { UserX, UserCheck, History, Pencil, ChevronRight } from "lucide-react";
import Select from "../../components/ui/Select";
import EmptyState from "../../components/ui/EmptyState";
import ErrorCarga from "../../components/ui/ErrorCarga";
import BotonCopiarEnlace from "../../components/dashboard/BotonCopiarEnlace";
import { tonoDeSector } from "../../lib/vozVacia";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { FiltroBarra } from "../../components/ui/filtros";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";
import { useConfirmarDescarte } from "../../hooks/useCambiosSinGuardar";
import { usePermisos } from "../../hooks/usePermisos";
import EditarClienteModal from "../../components/dashboard/EditarClienteModal";

type TabClientes = "todos" | "activos" | "inactivos";
const TAMANO = TAMANO_PAGINA;
const OPCIONES_DIAS = [30, 60, 90, 180] as const;

// Acciones de una fila: mismo alto táctil (44px en móvil, 36px en escritorio),
// icono + texto; donde el texto no cabe se oculta y queda en aria-label y title.
const BOTON_FILA =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] px-2.5 rounded-lg " +
  "text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const BOTON_FILA_NEUTRO =
  `${BOTON_FILA} border border-border dark:border-slate-600 text-foreground hover:bg-muted dark:hover:bg-slate-700`;
const BOTON_FILA_WHATSAPP =
  `${BOTON_FILA} bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366]`;

export default function ClientesPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  // La ruta ya es solo de Propietario; el permiso se comprueba igual por si cambia (decisión 2).
  const permisos = usePermisos();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabClientes>("todos");
  const [buscarActivo, setBuscarActivo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [clienteSel, setClienteSel] = useState<ClienteDto | null>(null);
  const [clienteEditar, setClienteEditar] = useState<ClienteDto | null>(null);
  const [notas, setNotas] = useState("");
  const [notasGuardadas, setNotasGuardadas] = useState(false);
  const [diasInactivo, setDiasInactivo] = useState<typeof OPCIONES_DIAS[number]>(60);
  const [paginaActividad, setPaginaActividad] = useState(1);
  const idActividad = useId();

  const { data: paginaClientes, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["clientes", buscarActivo, pagina],
    queryFn: () => clientesApi.obtenerTodos(buscarActivo || undefined, pagina, TAMANO),
    // Los modos de actividad traen su propio listado del servidor; sin esto el
    // directorio completo se pedía también ahí y su resultado se descartaba.
    enabled: tab === "todos",
  });

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  // El reparto en activos / inactivos / sin visitas lo hace el servidor. Antes
  // se traía una página de 500 y se repartía en memoria, así que un negocio con
  // más clientes que eso analizaba solo a los primeros 500 sin saberlo.
  const {
    data: listaActividad,
    isLoading: cargandoActividad,
    isError: errorActividad,
    isFetching: recargandoActividad,
    refetch: reintentarActividad,
  } = useQuery({
    queryKey: ["clientes-actividad", tab, diasInactivo, paginaActividad],
    queryFn: () =>
      clientesApi.obtenerPorActividad(
        tab as Exclude<TabClientes, "todos">,
        diasInactivo,
        paginaActividad,
        TAMANO
      ),
    enabled: tab !== "todos",
    placeholderData: (prev) => prev,
  });

  // Los tres conteos describen el directorio completo, no la página visible: su
  // razón de ser es cuadrar con el total para que el dueño pueda confiar en ellos.
  const { data: resumenActividad } = useQuery({
    queryKey: ["clientes-resumen-actividad", diasInactivo],
    queryFn: () => clientesApi.obtenerResumenActividad(diasInactivo),
    enabled: tab !== "todos",
  });

  // Un cambio de grupo o de umbral reordena el listado entero: la página en la
  // que estabas ya no significa lo mismo.
  useEffect(() => { setPaginaActividad(1); }, [tab, diasInactivo]);

  const ahora = useMemo(() => new Date(), []);

  const clientesActividad = listaActividad?.datos ?? [];
  const totalActividad = listaActividad?.total ?? 0;
  const totalPaginasActividad = Math.max(1, Math.ceil(totalActividad / TAMANO));

  const formatWaPhone = (tel: string) => {
    const digits = tel.replace(/\D/g, "");
    if (digits.startsWith("52") && digits.length >= 12) return digits;
    return `52${digits}`;
  };

  const whatsappDirecto = (tel: string) => `https://wa.me/${formatWaPhone(tel)}`;

  const whatsappReactivacion = (c: ClienteDto) => {
    const negocioNombre = negocio?.nombre ?? "nosotros";
    const link = negocio?.slug ? `${window.location.origin}/b/${negocio.slug}` : "";
    const dias = Math.floor((ahora.getTime() - new Date(c.ultimaCitaEn!).getTime()) / (1000 * 60 * 60 * 24));
    const nombre = c.nombreCompleto.split(" ")[0];
    // Tono neutral y sin emoji (OM-32): el mensaje sale a nombre del negocio.
    const msg =
      `Hola, ${nombre}. Han pasado ${dias} días desde tu última visita a *${negocioNombre}*.\n\n` +
      (link ? `Cuando quieras, puedes reservar tu próxima cita aquí:\n${link}\n\n` : "") +
      `Será un gusto atenderte de nuevo.`;
    return `https://wa.me/${formatWaPhone(c.telefono)}?text=${encodeURIComponent(msg)}`;
  };

  // Auto-abrir detalle si viene clienteId en la URL (e.g. desde CitasPage)
  const clienteIdParam = searchParams.get("clienteId");
  const { data: clienteDirecto } = useQuery({
    queryKey: ["cliente-directo", clienteIdParam],
    queryFn: () => clientesApi.obtenerPorId(clienteIdParam!),
    enabled: !!clienteIdParam && !clienteSel,
  });
  useEffect(() => {
    if (clienteDirecto && !clienteSel) {
      setClienteSel(clienteDirecto);
      setNotas(clienteDirecto.notas ?? "");
      setSearchParams({}, { replace: true });
    }
  }, [clienteDirecto, clienteSel, setSearchParams]);

  const clientes = paginaClientes?.datos ?? [];
  const totalClientes = paginaClientes?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(totalClientes / TAMANO));

  const { data: citasCliente = [], isLoading: cargandoCitas } = useQuery({
    queryKey: ["cliente-citas", clienteSel?.id],
    queryFn: () => clientesApi.obtenerCitas(clienteSel!.id),
    enabled: !!clienteSel,
  });

  const { mutate: guardarNotas, isPending: guardandoNotas } = useMutation({
    // Las notas llegan como variables desde el clic: useMutation actualiza
    // `mutationFn` en un efecto y un closure podría enviar un valor anterior.
    mutationFn: ({ id, notas }: { id: string; notas: string }) =>
      clientesApi.actualizarNotas(id, notas || null),
    onSuccess: (actualizado) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setClienteSel(actualizado);
      setNotasGuardadas(true);
      setTimeout(() => setNotasGuardadas(false), 2500);
    },
    onError: () => toast("No se pudieron guardar las notas. Intenta de nuevo.", "error"),
  });

  // Notas sin guardar (alergias, preferencias): se pregunta antes de cerrar.
  const descarte = useConfirmarDescarte();
  const notasSinGuardar = !!clienteSel && notas !== (clienteSel.notas ?? "");

  const abrirCliente = (c: ClienteDto) => {
    setClienteSel(c);
    setNotas(c.notas ?? "");
    setNotasGuardadas(false);
  };

  const buscarClientes = (termino: string) => { setPagina(1); setBuscarActivo(termino); };
  const limpiarBusqueda = () => { setBuscarActivo(""); setPagina(1); };

  // B18 / decisión 10: el archivo trae todo el directorio (o la búsqueda actual),
  // no solo la página visible. El servidor lo entrega completo y deja registro de
  // quién exportó, cuándo y cuántas filas.
  const [exportando, setExportando] = useState(false);
  const exportarClientes = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      let todos;
      try {
        todos = await clientesApi.exportar(buscarActivo || undefined);
      } catch (err) {
        toast(mensajeError(err, "No se pudo exportar el directorio. Intenta de nuevo."), "error");
        return;
      }
      const enc = ["Nombre", "Teléfono", "Correo", "Total citas", "Inasistencias", "Última visita", "Cliente desde"];
      const filas = todos.map((c) => [
        c.nombreCompleto,
        c.telefono,
        c.email ?? "",
        c.totalCitas,
        c.cantidadInasistencias,
        c.ultimaVisitaEn ? soloFecha(c.ultimaVisitaEn) : "",
        soloFecha(c.fechaCreacion),
      ]);
      await exportarExcel(enc, [filas], "clientes", terms.clientes)
        .catch(() => toast("No se pudo generar el archivo de Excel. Intenta de nuevo.", "error"));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo={terms.clientes}
        subtitulo={`Directorio, historial y notas de cada ${terms.cliente.toLowerCase()}`}
        acciones={
          /* Ya no lleva el aviso "Solo esta página": el archivo trae las
             {totalClientes} filas del directorio (o de la búsqueda), no la página. */
          permisos.exportar && tab === "todos" && clientes.length > 0 && (
            <div className="flex flex-col items-end gap-0.5">
              <BotonAccion
                variante="secundaria"
                onClick={exportarClientes}
                disabled={exportando}
                aria-busy={exportando}
                title={`Exporta los ${totalClientes} ${terms.clientes.toLowerCase()} ${buscarActivo ? "de la búsqueda" : "del directorio"}`}
              >
                {exportando ? "Exportando..." : "Exportar Excel"}
              </BotonAccion>
              <span className="text-xs text-muted-foreground tabular-nums">
                {buscarActivo ? "Toda la búsqueda" : "Todo el directorio"}: {totalClientes}
              </span>
            </div>
          )
        }
      />

      {/* Una sola barra para los tres modos: "Activos" e "Inactivos" acotan el
          mismo listado en vez de abrir otra sección, así que son un filtro más
          —no pestañas— y se leen en la misma fila que la búsqueda. "Actividad"
          y no "Estado": "Estado" ya nombra el estado de la cita en el resto del
          dashboard. */}
      <FiltroBarra
        etiqueta={`Filtros de ${terms.clientes.toLowerCase()}`}
        busqueda={
          tab === "todos"
            ? {
                valor: buscarActivo,
                onChange: buscarClientes,
                etiqueta: `Buscar ${terms.cliente.toLowerCase()}`,
                placeholder: "Buscar por nombre o teléfono...",
              }
            : undefined
        }
        accion={
          <div className="w-full sm:w-auto">
            <span
              id={idActividad}
              className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Actividad
            </span>
            <Select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabClientes)}
              aria-labelledby={idActividad}
              className="w-full sm:w-56"
            >
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </Select>
          </div>
        }
        campos={
          tab !== "todos"
            ? [
                {
                  tipo: "pills",
                  id: "diasActividad",
                  // El umbral es el mismo en los dos modos, pero la frase no:
                  // "Sin visitar en 30 días" describe justo lo contrario de lo
                  // que se está listando cuando el modo es Activos.
                  etiqueta: tab === "activos" ? "Con visita en los últimos" : "Sin visitar en",
                  valor: String(diasInactivo),
                  onChange: (v) => setDiasInactivo(Number(v) as typeof OPCIONES_DIAS[number]),
                  valorNeutro: "60",
                  opciones: OPCIONES_DIAS.map((d) => ({ valor: String(d), etiqueta: `${d} días` })),
                },
              ]
            : []
        }
        onLimpiar={tab === "todos" ? limpiarBusqueda : () => setDiasInactivo(60)}
      />

      {/* ── Modos de actividad: Activos / Inactivos ── */}
      {tab !== "todos" && (
        <div className="space-y-5">
          {cargandoActividad ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : errorActividad && !listaActividad ? (
            <ErrorCarga
              mensaje={`No se pudieron cargar los ${terms.clientes.toLowerCase()}.`}
              onReintentar={() => reintentarActividad()}
              reintentando={recargandoActividad}
            />
          ) : (
            <>
              {/* El resumen va antes del listado —y también cuando el grupo
                  elegido está vacío— porque es donde cuadran las cuentas: si
                  "sin visitas" solo apareciera junto a una lista con filas, el
                  grupo se volvería invisible justo cuando más desconcierta.
                  El aviso ámbar que lo acompañaba solo existía para confesar el
                  tope de 500; el análisis ya recorre el directorio entero, así
                  que dejarlo sería advertir de un recorte que no ocurre. */}
              <div className="space-y-1">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {totalActividad} cliente{totalActividad !== 1 ? "s" : ""}{" "}
                  {tab === "activos"
                    ? `con visita en los últimos ${diasInactivo} días`
                    : `sin visitar en más de ${diasInactivo} días`}
                </p>
                {resumenActividad && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    De {resumenActividad.total} {terms.clientes.toLowerCase()}: {resumenActividad.activos} activos,{" "}
                    {resumenActividad.inactivos} inactivos y {resumenActividad.sinVisitas} sin visitas registradas
                    {resumenActividad.sinVisitas > 0 && " (nunca se les agendó una cita, así que no cuentan en ninguno de los dos grupos)"}.
                  </p>
                )}
              </div>

              {clientesActividad.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  {tab === "activos" ? (
                    <EmptyState
                      icon={<UserCheck size={40} strokeWidth={1.5} />}
                      title={`Sin ${terms.clientes.toLowerCase()} activos`}
                      description={`Ningún ${terms.cliente.toLowerCase()} ha visitado en los últimos ${diasInactivo} días`}
                    />
                  ) : (
                    <EmptyState
                      icon={<UserX size={40} strokeWidth={1.5} />}
                      title={`Sin ${terms.clientes.toLowerCase()} inactivos`}
                      description={`Todos tus ${terms.clientes.toLowerCase()} han visitado en los últimos ${diasInactivo} días`}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 divide-y divide-slate-50 dark:divide-slate-700">
                {clientesActividad.map((c) => {
                  const dias = Math.floor(
                    (ahora.getTime() - new Date(c.ultimaCitaEn!).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                          {c.nombreCompleto.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{c.nombreCompleto}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {c.telefono} · {c.totalCitas} cita{c.totalCitas !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {tab === "activos" ? (
                        // Fecha y no "hace N días": `ultimaCitaEn` guarda el
                        // inicio de la última cita agendada, que puede estar en
                        // el futuro, y entonces el conteo saldría en negativo.
                        // Formato corto: la fecha larga se come el ancho del
                        // nombre en móvil.
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatFechaCorta(c.ultimaCitaEn!)}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">última cita</p>
                        </div>
                      ) : (
                        <div className="text-right shrink-0 mr-2">
                          <p className="text-sm font-bold text-amber-500">{dias} días</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">sin visitar</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => abrirCliente(c)}
                          aria-label={`Ver historial de ${c.nombreCompleto}`}
                          title="Ver historial"
                          className={BOTON_FILA_NEUTRO}
                        >
                          <History size={15} aria-hidden="true" />
                          <span className="hidden md:inline">Historial</span>
                        </button>
                        {permisos.editarCliente && (
                          <button
                            type="button"
                            onClick={() => setClienteEditar(c)}
                            aria-label={`Editar ${c.nombreCompleto}`}
                            title={`Editar ${terms.cliente.toLowerCase()}`}
                            className={BOTON_FILA_NEUTRO}
                          >
                            <Pencil size={15} aria-hidden="true" />
                            <span className="hidden md:inline">Editar</span>
                          </button>
                        )}
                        {tab === "inactivos" && c.telefono && (
                          <a
                            href={whatsappReactivacion(c)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Enviar mensaje de reactivación a ${c.nombreCompleto}`}
                            title="Enviar mensaje de reactivación por WhatsApp"
                            className={`${BOTON_FILA_WHATSAPP} font-semibold`}
                          >
                            <SiWhatsapp size={14} aria-hidden="true" />
                            <span className="hidden md:inline">Reactivar</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
                <Pagination
                  pagina={paginaActividad}
                  totalPaginas={totalPaginasActividad}
                  total={totalActividad}
                  labelTotal={terms.clientes.toLowerCase()}
                  onCambiar={setPaginaActividad}
                  cargando={cargandoActividad}
                />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Todos ── */}
      {tab === "todos" && (<>
      {/* Lista */}
      {isLoading ? (
        <p className="text-slate-400 dark:text-slate-500">Cargando clientes...</p>
      ) : isError && !paginaClientes ? (
        // Un 500 no es un directorio vacío: "Aún no hay clientes" haría creer
        // que se perdieron los datos.
        <ErrorCarga
          mensaje={`No se pudieron cargar los ${terms.clientes.toLowerCase()}.`}
          onReintentar={() => refetch()}
          reintentando={isFetching}
        />
      ) : clientes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
          {buscarActivo ? (
            <EmptyState
              variante="sinResultados"
              title="Sin resultados"
              description={`No hay ${terms.clientes.toLowerCase()} que coincidan con tu búsqueda`}
              onLimpiarFiltros={limpiarBusqueda}
              labelLimpiarFiltros={`Ver todos los ${terms.clientes.toLowerCase()}`}
            />
          ) : (
            <EmptyState
              voz="clientes"
              tono={tonoDeSector(negocio?.sector)}
              action={negocio?.slug ? <BotonCopiarEnlace url={`${window.location.origin}/b/${negocio.slug}`} /> : undefined}
            />
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-3 dark:text-slate-500">{totalClientes} {totalClientes !== 1 ? terms.clientes.toLowerCase() : terms.cliente.toLowerCase()}</p>
          {/* Teléfono: tarjetas apiladas; toda la tarjeta abre el detalle. La tabla
              de abajo dejaba "Ver detalle" fuera de la pantalla a 375 px. */}
          <ul className="sm:hidden bg-white rounded-xl border border-slate-100 divide-y divide-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:divide-slate-700" aria-label={terms.clientes}>
            {clientes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => abrirCliente(c)}
                  aria-label={`Ver detalle de ${c.nombreCompleto}`}
                  className="w-full min-h-[44px] flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-foreground">
                    {c.nombreCompleto.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-slate-800 dark:text-slate-200 truncate">{c.nombreCompleto}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{c.telefono}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {c.ultimaVisitaEn ? `Última visita: ${formatFecha(c.ultimaVisitaEn)}` : "Sin visitas"}
                      {c.cantidadInasistencias > 0 && (
                        <span className="text-red-600 dark:text-red-400">{` · ${c.cantidadInasistencias} inasistencia${c.cantidadInasistencias === 1 ? "" : "s"}`}</span>
                      )}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block bg-white rounded-xl border border-slate-100 overflow-x-auto dark:bg-slate-800 dark:border-slate-700">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide dark:border-slate-700 dark:text-slate-500">
                  <th className="text-left px-5 py-3 font-medium">{terms.cliente}</th>
                  <th className="text-left px-5 py-3 font-medium">Contacto</th>
                  <th className="text-center px-5 py-3 font-medium">{terms.citas}</th>
                  <th className="text-center px-5 py-3 font-medium">Inasistencias</th>
                  <th className="text-left px-5 py-3 font-medium">Última visita</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  // Toda la fila abre el detalle con el ratón; el botón de la
                  // última columna sigue siendo el camino para el teclado.
                  <tr
                    key={c.id}
                    onClick={() => abrirCliente(c)}
                    className="border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer dark:border-slate-700 dark:hover:bg-slate-700"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-foreground">
                            {c.nombreCompleto.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="font-medium text-slate-800 dark:text-slate-200">{c.nombreCompleto}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-700 dark:text-slate-300">{c.telefono}</p>
                      {c.email && <p className="text-xs text-slate-400 dark:text-slate-500">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.totalCitas}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {c.cantidadInasistencias > 0 ? (
                        <span className="font-medium text-red-500">{c.cantidadInasistencias}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    {/* Última cita completada, no la última agendada: esa puede
                        estar en el futuro y "Última visita" no puede ser mañana. */}
                    <td className="px-5 py-3 text-slate-600 text-sm dark:text-slate-400">
                      {c.ultimaVisitaEn ? formatFecha(c.ultimaVisitaEn) : <span className="text-slate-400 dark:text-slate-500">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); abrirCliente(c); }}
                          aria-label={`Ver historial de ${c.nombreCompleto}`}
                          className={BOTON_FILA_NEUTRO}
                        >
                          <History size={15} aria-hidden="true" />
                          Historial
                        </button>
                        {permisos.editarCliente && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setClienteEditar(c); }}
                            aria-label={`Editar ${c.nombreCompleto}`}
                            className={BOTON_FILA_NEUTRO}
                          >
                            <Pencil size={15} aria-hidden="true" />
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Un solo paginador para las dos vistas (tarjetas y tabla). */}
          <div className="mt-2 bg-white rounded-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
            <Pagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalClientes}
              labelTotal="clientes"
              onCambiar={setPagina}
              cargando={isLoading}
            />
          </div>
        </>
      )}

      </>)}

      {/* Modal detalle cliente */}
      <Modal
        abierto={!!clienteSel}
        onCerrar={() => descarte.pedirCierre(notasSinGuardar, () => setClienteSel(null))}
        titulo={clienteSel?.nombreCompleto ?? ""}
      >
        {clienteSel && (
          <div className="space-y-5">
            {/* Acciones del cliente: editar sus datos y escribirle. El historial
                y las notas son el contenido de este mismo diálogo. */}
            {(permisos.editarCliente || clienteSel.telefono) && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Acciones del ${terms.cliente.toLowerCase()}`}>
                {permisos.editarCliente && (
                  <BotonAccion variante="secundaria" onClick={() => setClienteEditar(clienteSel)} className="flex-1 sm:flex-none">
                    <Pencil size={15} aria-hidden="true" />
                    Editar datos
                  </BotonAccion>
                )}
                {clienteSel.telefono && (
                  <a
                    href={whatsappDirecto(clienteSel.telefono)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Escribir por WhatsApp a ${clienteSel.nombreCompleto}`}
                    className={`${BOTON_FILA_WHATSAPP} flex-1 sm:flex-none px-3.5 text-sm font-semibold`}
                  >
                    <SiWhatsapp size={15} aria-hidden="true" />
                    WhatsApp
                  </a>
                )}
              </div>
            )}

            {/* Info básica */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                <p className="text-xs text-slate-400 mb-0.5 dark:text-slate-500">Teléfono</p>
                <p className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">{clienteSel.telefono || "—"}</p>
              </div>
              {clienteSel.email && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                  <p className="text-xs text-slate-400 mb-0.5 dark:text-slate-500">Correo</p>
                  <p className="font-medium text-slate-800 truncate dark:text-slate-200">{clienteSel.email}</p>
                </div>
              )}
              <div className="bg-slate-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                <p className="text-xs text-slate-400 mb-0.5 dark:text-slate-500">Total citas</p>
                <p className="font-bold text-slate-800 text-lg dark:text-slate-200">{clienteSel.totalCitas}</p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                <p className="text-xs text-slate-400 mb-0.5 dark:text-slate-500">Inasistencias</p>
                <p className={`font-bold text-lg ${clienteSel.cantidadInasistencias > 0 ? "text-red-500" : "text-slate-800 dark:text-slate-200"}`}>
                  {clienteSel.cantidadInasistencias}
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2 col-span-2 dark:bg-slate-700">
                <p className="text-xs text-slate-400 mb-0.5 dark:text-slate-500">{`${terms.cliente} desde`}</p>
                <p className="font-medium text-slate-800 dark:text-slate-200">{formatFecha(clienteSel.fechaCreacion)}</p>
              </div>
            </div>

            {/* Historial citas */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2 dark:text-slate-300">Historial de citas</p>
              {cargandoCitas ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Cargando historial...</p>
              ) : citasCliente.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Sin citas registradas</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {citasCliente.map((cita) => (
                    <div key={cita.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2 dark:bg-slate-700">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate dark:text-slate-200">{cita.nombreServicio}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {cita.nombreEmpleado} · {formatFechaHora(cita.inicioEn)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{formatPrecio(cita.precio)}</span>
                        <EstadoBadge estado={cita.estadoTexto} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notas */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
                Notas internas
                <span className="text-slate-400 font-normal ml-1 dark:text-slate-500">(solo visible para ti)</span>
              </label>
              <textarea
                value={notas}
                onChange={(e) => { setNotas(e.target.value); setNotasGuardadas(false); }}
                rows={3}
                placeholder="Preferencias, alergias, observaciones..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-accent-brand resize-none dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600"
              />
              <div className="flex items-center gap-3 mt-2">
                <BotonAccion
                  onClick={() => guardarNotas({ id: clienteSel.id, notas })}
                  disabled={guardandoNotas || notas === (clienteSel.notas ?? "")}
                >
                  {guardandoNotas ? "Guardando..." : "Guardar notas"}
                </BotonAccion>
                {notasGuardadas && (
                  <span role="status" className="text-xs text-green-700 dark:text-green-400 font-medium">Guardado</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <EditarClienteModal
        cliente={clienteEditar}
        onCerrar={() => setClienteEditar(null)}
        onGuardado={(actualizado) => {
          // Si el detalle de este cliente está abierto, se refresca con los datos nuevos.
          setClienteSel((sel) => (sel && sel.id === actualizado.id ? actualizado : sel));
        }}
      />
      {descarte.dialogo}
    </div>
  );
}
