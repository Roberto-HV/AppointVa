import { useState } from "react";
import { useSectorTerms } from "../../hooks/useSectorTerms";

import { hoy, inicioSemana, finSemana, inicioMes, finMes } from "../../utils/fechas";
import { Calendar, CheckCircle2, RotateCcw, StickyNote, Receipt, Banknote, Star, Pencil, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { citasApi, ESTADOS } from "../../api/citas";
import Tabs from "../../components/ui/Tabs";
import EmptyState from "../../components/ui/EmptyState";
import { FiltroBarra, campoActivo, type CampoFiltro } from "../../components/ui/filtros";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { negociosApi } from "../../api/negocios";
import { api } from "../../api/axios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import Modal from "../../components/ui/Modal";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import AccionesCita, { HojaAccionesCita, type AccionExtraCita } from "../../components/dashboard/AccionesCita";
import TarjetaCita, { InsigniasCita } from "../../components/dashboard/TarjetaCita";
import { useMediaQuery, CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { invalidarCitas, useReagendarCita } from "../../hooks/useMutacionesCita";
import { urlResenaWhatsApp } from "../../utils/whatsapp";
import { DatePicker } from "../../components/ui/DateTimePicker";
import CalendarioCitas from "../../components/dashboard/CalendarioCitas";
import GanttCitas from "../../components/dashboard/GanttCitas";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import { useToastStore } from "../../store/toastStore";
import type { CitaDto, SlotDisponible } from "../../types";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { reportesApi } from "../../api/reportes";
import { formatPrecio, formatFechaHoraCorta as formatFechaHora, formatFechaCorta, formatHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import BotonAccion, { EnlaceAccion } from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";


export default function CitasPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const terms = useSectorTerms();
  const esMovil = useMediaQuery(CONSULTA_MOVIL);

  const [vista, setVista] = useState<"lista" | "calendario" | "gantt">("lista");
  const [desde, setDesde] = useState(() => hoy());
  const [hasta, setHasta] = useState(() => hoy());
  const [empleadoId, setEmpleadoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const TAMANO = TAMANO_PAGINA;

  // Hoja de acciones abierta desde el calendario o el Gantt (las filas abren la suya).
  const [citaAcciones, setCitaAcciones] = useState<CitaDto | null>(null);

  // Confirmación para anular un anticipo ya registrado
  const [citaAnularAnticipo, setCitaAnularAnticipo] = useState<CitaDto | null>(null);

  // Modal notas
  const [citaNotas, setCitaNotas] = useState<CitaDto | null>(null);
  const [notasTexto, setNotasTexto] = useState("");

  // Modal comprobante
  const [urlComprobante, setUrlComprobante] = useState<string | null>(null);

  // Modal repetir cita
  const [citaRepetir, setCitaRepetir] = useState<CitaDto | null>(null);
  const [slotRepetir, setSlotRepetir] = useState<SlotDisponible | null>(null);
  const [pasoRepetir, setPasoRepetir] = useState<1 | 2>(1);
  const [fClienteRepetir, setFClienteRepetir] = useState({ nombre: "", telefono: "", email: "", notas: "" });
  const [emailRepetirError, setEmailRepetirError] = useState("");

  // Modal nueva cita
  const [modalNueva, setModalNueva] = useState(false);
  const [pasoCita, setPasoCita] = useState<1 | 2>(1);
  const [svcSel, setSvcSel] = useState("");
  const [empSel, setEmpSel] = useState("");
  const [fechaNueva, setFechaNueva] = useState("");
  const [slotNuevo, setSlotNuevo] = useState("");
  const [fCliente, setFCliente] = useState({ nombre: "", telefono: "", email: "", notas: "" });
  const [emailClienteError, setEmailClienteError] = useState("");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Modal editar cliente
  const [citaEditar, setCitaEditar] = useState<CitaDto | null>(null);
  const [fEditar, setFEditar] = useState({ nombre: "", telefono: "", email: "" });
  const [emailEditarError, setEmailEditarError] = useState("");

  // Issue 12 — drag-to-reschedule confirmation
  const [confirmDrag, setConfirmDrag] = useState<{id: string; nombre: string; nuevoInicio: string; label: string} | null>(null);

  const validarEmailCliente = (v: string) =>
    v.trim() && !EMAIL_RE.test(v.trim()) ? "Correo no válido (ej: nombre@dominio.com)" : "";

  // La búsqueda ya llega confirmada desde la barra; aquí solo vuelve a la página 1.
  const aplicarBusqueda = (v: string) => { setBusqueda(v); setPagina(1); };

  // ── Queries ──────────────────────────────────────────────────────────────────
  const estadoNum = estadoFiltro ? ESTADOS[estadoFiltro as keyof typeof ESTADOS] : undefined;

  const { data: pagCitas, isLoading } = useQuery({
    queryKey: ["citas", desde, hasta, empleadoId, busqueda, estadoFiltro, pagina],
    queryFn: () => citasApi.obtenerTodas({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
      busqueda: busqueda || undefined,
      estado: estadoNum,
      pagina,
      tamano: TAMANO,
    }),
    enabled: vista === "lista",
    placeholderData: (prev) => prev,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const citas = pagCitas?.datos ?? [];
  const totalCitas = pagCitas?.total ?? 0;
  const totalPaginas = Math.ceil(totalCitas / TAMANO) || 1;

  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil-layout"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 5,
  });
  const nombreNegocio = perfil?.nombre ?? "";
  const tienePagos = perfil?.moduloPagosHabilitado ?? false;

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios"],
    queryFn: () => serviciosApi.obtenerTodos(),
  });

  const empleadosFiltrados = svcSel
    ? empleados.filter((e) => e.servicioIds.includes(svcSel) && e.activo)
    : empleados.filter((e) => e.activo);

  const { data: slotsNueva = [], isFetching: cargandoSlotsNueva, isError: errorSlotsNueva } = useQuery({
    queryKey: ["slots-nueva", svcSel, empSel, fechaNueva],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: svcSel, empleadoId: empSel, fecha: fechaNueva },
      });
      return data;
    },
    enabled: !!svcSel && !!empSel && !!fechaNueva,
  });



  // ── Mutations ────────────────────────────────────────────────────────────────
  // Solo para soltar una cita en el calendario: el resto de acciones vive en la hoja.
  const { mutate: reagendar } = useReagendarCita();

  const { mutate: crearCita, isPending: creando } = useMutation({
    mutationFn: () => citasApi.crear({
      servicioId: svcSel,
      empleadoId: empSel,
      inicioEn: slotNuevo,
      nombreCliente: fCliente.nombre.trim(),
      telefonoCliente: fCliente.telefono.trim(),
      emailCliente: fCliente.email.trim() || undefined,
      notas: fCliente.notas.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setModalNueva(false);
      setPasoCita(1);
      setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
      setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
      setEmailClienteError("");
      toast(`${terms.cita} creada`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? `No se pudo crear la ${terms.cita.toLowerCase()}`;
      toast(msg, "error");
    },
  });

  const { mutate: editarCliente, isPending: editando } = useMutation({
    mutationFn: () => citasApi.editarCliente(citaEditar!.id, {
      nombreCompleto: fEditar.nombre.trim(),
      telefono: fEditar.telefono.trim(),
      email: fEditar.email.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setCitaEditar(null);
      toast("Datos del cliente actualizados");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { status?: number; data?: { mensaje?: string } } };
      const msg = e?.response?.data?.mensaje
        ?? (e?.response?.status === 409
          ? "Ese teléfono o correo ya está registrado con otra clienta"
          : "No se pudo actualizar el cliente");
      toast(msg, "error");
    },
  });

  const abrirEditar = (c: CitaDto) => {
    setCitaEditar(c);
    setFEditar({ nombre: c.nombreCliente, telefono: c.telefonoCliente ?? "", email: c.emailCliente ?? "" });
    setEmailEditarError("");
  };

  const abrirNuevaCita = () => {
    setModalNueva(true);
    setPasoCita(1);
    setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
    setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
    setEmailClienteError("");
  };

  const abrirRepetirCita = (c: CitaDto) => {
    setCitaRepetir(c);
    setSlotRepetir(null);
    setPasoRepetir(1);
    setFClienteRepetir({
      nombre: c.nombreCliente,
      telefono: c.telefonoCliente,
      email: c.emailCliente ?? "",
      notas: "",
    });
    setEmailRepetirError("");
  };

  const { mutate: actualizarNotas, isPending: guardandoNotas } = useMutation({
    mutationFn: ({ id, notas }: { id: string; notas: string | null }) =>
      citasApi.actualizarNotas(id, notas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaNotas(null);
      setNotasTexto("");
      toast("Notas guardadas");
    },
    onError: () => toast("No se pudieron guardar las notas. Intenta de nuevo.", "error"),
  });

  const { mutate: repetirCita, isPending: repitiendo } = useMutation({
    mutationFn: () => citasApi.crear({
      servicioId: citaRepetir!.servicioId,
      empleadoId: citaRepetir!.empleadoId,
      inicioEn: slotRepetir!.inicio,
      nombreCliente: fClienteRepetir.nombre.trim(),
      telefonoCliente: fClienteRepetir.telefono.trim(),
      emailCliente: fClienteRepetir.email.trim() || undefined,
      notas: fClienteRepetir.notas.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setCitaRepetir(null);
      setSlotRepetir(null);
      setPasoRepetir(1);
      setFClienteRepetir({ nombre: "", telefono: "", email: "", notas: "" });
      setEmailRepetirError("");
      toast(`${terms.cita} creada`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? `No se pudo crear la ${terms.cita.toLowerCase()}`;
      toast(msg, "error");
    },
  });

  const mutAnticipo = useMutation({
    mutationFn: ({ id, recibido }: { id: string; recibido: boolean }) =>
      citasApi.registrarAnticipo(id, recibido),
    onSuccess: (_, { recibido }) => {
      // Todas las vistas de citas: lista, calendario, Gantt, inicio y cobro.
      invalidarCitas(qc);
      setCitaAnularAnticipo(null);
      toast(recibido ? "Anticipo registrado" : "Anticipo anulado");
    },
    onError: () => toast("No se pudo actualizar el anticipo", "error"),
  });

  // ── Filtros ──────────────────────────────────────────────────────────────────
  // Todo cambio de filtro vuelve a la página 1: quedarse en la 7 tras filtrar
  // devolvía una tabla vacía que parecía "sin resultados".
  const campoEmpleado: CampoFiltro = {
    tipo: "select",
    id: "empleado",
    etiqueta: "Profesional",
    valor: empleadoId,
    onChange: (v) => { setEmpleadoId(v); setPagina(1); },
    opciones: empleados.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
  };

  const campos: CampoFiltro[] = [
    campoEmpleado,
    {
      tipo: "select",
      id: "estado",
      etiqueta: "Estado",
      valor: estadoFiltro,
      onChange: (v) => { setEstadoFiltro(v); setPagina(1); },
      etiquetaNeutra: "Todos",
      opciones: ["Pendiente", "Confirmada", "Completada", "Cancelada", "Inasistencia"]
        .map((e) => ({ valor: e, etiqueta: e })),
    },
    {
      tipo: "rangoFechas",
      id: "periodo",
      etiqueta: "Período",
      desde,
      hasta,
      onChange: (d, h) => { setDesde(d); setHasta(h); setPagina(1); },
      presets: [
        { etiqueta: "Hoy", desde: hoy(), hasta: hoy() },
        { etiqueta: "Semana", desde: inicioSemana(), hasta: finSemana() },
        { etiqueta: "Mes", desde: inicioMes(), hasta: finMes() },
      ],
    },
  ];

  // Uno solo para la barra y para el estado vacío. Antes eran dos handlers
  // distintos y el del estado vacío se olvidaba de `empleadoId`.
  const limpiarFiltros = () => {
    setDesde(""); setHasta(""); setEmpleadoId("");
    setBusqueda(""); setEstadoFiltro(""); setPagina(1);
  };

  const hayFiltrosActivos =
    Boolean(busqueda) || campos.some(campoActivo);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const abrirNotas = (c: CitaDto) => {
    setCitaNotas(c);
    setNotasTexto(c.notas ?? "");
  };


  // ── Acciones extra de la hoja ────────────────────────────────────────────────
  // Lo que antes eran nueve iconos por fila vive en la hoja de acciones, con
  // texto. La fila solo deja WhatsApp, la acción principal y "Acciones".
  const anticipoEnCurso = (id: string) => mutAnticipo.isPending && mutAnticipo.variables?.id === id;

  const accionesExtra = (c: CitaDto): AccionExtraCita[] => [
    {
      id: "notas",
      etiqueta: c.notas ? "Ver o editar nota interna" : "Agregar nota interna",
      Icono: StickyNote,
      marcador: !!c.notas,
      onSelect: () => abrirNotas(c),
    },
    { id: "editar", etiqueta: `Editar datos del ${terms.cliente.toLowerCase()}`, Icono: Pencil, onSelect: () => abrirEditar(c) },
    ...(c.anticipoRequerido && !c.pagada
      ? [c.anticipoRecibido
          ? { id: "anticipo", etiqueta: "Anular anticipo", Icono: Banknote, onSelect: () => setCitaAnularAnticipo(c) }
          : {
              id: "anticipo",
              etiqueta: anticipoEnCurso(c.id)
                ? "Registrando anticipo…"
                : `Registrar anticipo de ${formatPrecio(c.montoAnticipo ?? 0)}`,
              Icono: Banknote,
              // Mientras el registro de esta cita está en curso no se puede volver
              // a enviar: la hoja se reabre con la acción deshabilitada.
              deshabilitada: anticipoEnCurso(c.id),
              onSelect: () => {
                if (mutAnticipo.isPending) return;
                mutAnticipo.mutate({ id: c.id, recibido: true });
              },
            }]
      : []),
    ...(c.comprobanteUrl
      ? [{ id: "comprobante", etiqueta: "Ver comprobante de anticipo", Icono: Receipt, onSelect: () => setUrlComprobante(c.comprobanteUrl!) }]
      : []),
    { id: "repetir", etiqueta: `Repetir ${terms.cita.toLowerCase()}`, Icono: RotateCcw, onSelect: () => abrirRepetirCita(c) },
    ...(c.estadoTexto === "Completada" && c.telefonoCliente
      ? [{ id: "resena", etiqueta: "Solicitar reseña por WhatsApp", Icono: Star, href: urlResenaWhatsApp(c, nombreNegocio, perfil?.slug) }]
      : []),
  ];

  // ── Excel export ─────────────────────────────────────────────────────────────
  const exportarCSV = () => {
    reportesApi.exportarCitasCsv({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
      estado: estadoNum,
    }).catch(() => toast("No se pudo exportar el reporte. Intenta de nuevo.", "error"));
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 overflow-x-hidden">
      {/* Encabezado */}
      <div className="mb-6 space-y-3">

        {/* Fila 1 — título + acciones desktop */}
        <EncabezadoPagina
          titulo={terms.citas}
          subtitulo="Agenda del día, confirmaciones y reprogramaciones"
          acciones={
            /* Recepción y Exportar siguen ocultas bajo `sm`: son atajos de
               mostrador y, con las tres visibles, a 390px la fila ocuparía más
               ancho que la pantalla. Crear la cita es la única que queda. */
            <>
              <EnlaceAccion
                to="/dashboard/kiosk"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex"
              >
                🖥 Recepción
              </EnlaceAccion>
              {citas.length > 0 && vista === "lista" && (
                <BotonAccion
                  variante="secundaria"
                  onClick={exportarCSV}
                  className="hidden sm:inline-flex"
                >
                  Exportar Excel
                </BotonAccion>
              )}
              <BotonAccion onClick={abrirNuevaCita}>
                {`+ Nueva ${terms.cita.toLowerCase()}`}
              </BotonAccion>
            </>
          }
        />

        {/* Fila 2 — tabs */}
        <Tabs
          etiqueta={`Vista de ${terms.citas.toLowerCase()}`}
          valor={vista}
          onChange={setVista}
          opciones={[
            { id: "lista", label: "Lista" },
            { id: "calendario", label: "Calendario" },
            { id: "gantt", label: "Línea de tiempo" },
          ]}
        />

      </div>

      {/* Filtros — la vista calendario reusa el mismo campo de profesional */}
      {(vista === "lista" || (vista === "calendario" && empleados.length > 1)) && (
        <FiltroBarra
          etiqueta={`Filtros de ${terms.citas.toLowerCase()}`}
          busqueda={
            vista === "lista"
              ? {
                  valor: busqueda,
                  onChange: aplicarBusqueda,
                  etiqueta: "Buscar cliente",
                  placeholder: "Nombre o teléfono...",
                }
              : undefined
          }
          campos={vista === "lista" ? campos : [campoEmpleado]}
          onLimpiar={limpiarFiltros}
        />
      )}

      {/* Vista calendario */}
      {vista === "calendario" && (
        <CalendarioCitas
          empleadoId={empleadoId}
          onCitaClick={setCitaAcciones}
          onReagendar={(cita, nuevoInicio) => {
            const nueva = new Date(nuevoInicio).toLocaleString("es-MX", {
              weekday: "short", day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit", hour12: true,
            });
            setConfirmDrag({ id: cita.id, nombre: cita.nombreCliente, nuevoInicio: nuevoInicio, label: nueva });
          }}
        />
      )}

      {/* Vista línea de tiempo (Gantt) */}
      {vista === "gantt" && (
        <GanttCitas onCitaClick={setCitaAcciones} />
      )}

      {/* Vista lista */}
      {vista === "lista" && (
        isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody><SkeletonTableRows filas={6} columnas={5} /></tbody>
            </table>
          </div>
        ) : citas.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
            <EmptyState
              variante={hayFiltrosActivos ? "sinResultados" : "vacio"}
              icon={hayFiltrosActivos ? undefined : <Calendar size={40} strokeWidth={1.5} />}
              title={
                estadoFiltro
                  ? `Sin ${terms.citas.toLowerCase()} ${estadoFiltro.toLowerCase()}s`
                  : `No hay ${terms.citas.toLowerCase()} en este rango`
              }
              onLimpiarFiltros={hayFiltrosActivos ? limpiarFiltros : undefined}
            />
          </div>
        ) : esMovil ? (
          // Teléfono: tarjetas apiladas con las acciones a la vista. La tabla medía
          // 482px a 375px y dejaba WhatsApp y "Acciones" fuera de la pantalla.
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
            <ul className="divide-y divide-gray-100 dark:divide-slate-700" aria-label={terms.citas}>
              {citas.map((c) => (
                <li key={c.id}>
                  <TarjetaCita cita={c} accionesExtra={accionesExtra(c)} nombreNegocio={nombreNegocio} mostrarPago={tienePagos} />
                </li>
              ))}
            </ul>

            <Pagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalCitas}
              labelTotal="citas"
              onCambiar={setPagina}
              cargando={isLoading}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Servicio</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Profesional</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha y hora</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Precio</th>
                  {tienePagos && <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Pago</th>}
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{c.nombreCliente}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{c.telefonoCliente}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{c.nombreServicio}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{c.nombreEmpleado}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs sm:text-sm whitespace-nowrap">
                      <p>{formatFechaCorta(c.inicioEn)}</p>
                      <p className="text-gray-400 dark:text-gray-500">{formatHora(c.inicioEn)}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200 hidden sm:table-cell">{formatPrecio(c.precio)}</td>

                    {/* Columna de pago — solo lectura */}
                    {tienePagos && (
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {c.pagada ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            <CheckCircle2 size={11} aria-hidden="true" /> {c.metodoPago ?? "Pagado"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Por pagar</span>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <EstadoBadge estado={c.estadoTexto} />
                        <InsigniasCita cita={c} />
                      </div>
                    </td>

                    {/* Acciones: las mismas en todas las anchuras; el resto vive en la hoja */}
                    <td className="px-2 sm:px-4 py-2 text-right">
                      <AccionesCita cita={c} accionesExtra={accionesExtra(c)} nombreNegocio={nombreNegocio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalCitas}
              labelTotal="citas"
              onCambiar={setPagina}
              cargando={isLoading}
            />
          </div>
        )
      )}


      {/* ── Modal: Editar cliente ── */}
      <Modal abierto={!!citaEditar} onCerrar={() => setCitaEditar(null)} titulo="Editar datos del cliente" ancho="sm">
        {citaEditar && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fEditar.nombre}
                onChange={(e) => setFEditar((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono{" "}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  {fEditar.telefono ? "(vaciar para desvincular esta cita de la cliente)" : "(sin teléfono — cita independiente)"}
                </span>
              </label>
              <input
                type="tel"
                value={fEditar.telefono}
                onChange={(e) => setFEditar((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="Sin teléfono"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Correo <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="email"
                value={fEditar.email}
                onChange={(e) => {
                  setFEditar((p) => ({ ...p, email: e.target.value }));
                  setEmailEditarError(validarEmailCliente(e.target.value));
                }}
                placeholder="correo@ejemplo.com"
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 ${
                  emailEditarError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-slate-600"
                }`}
              />
              {emailEditarError && <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1"><AlertTriangle size={12} aria-hidden="true" /> {emailEditarError}</p>}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              Esto actualiza los datos de la cliente en todas sus citas.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCitaEditar(null)}
                className="px-4 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => { if (!emailEditarError) editarCliente(); }}
                disabled={!fEditar.nombre.trim() || editando || !!emailEditarError}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {editando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Notas internas ── */}
      <Modal abierto={!!citaNotas} onCerrar={() => setCitaNotas(null)} titulo="Nota interna" ancho="sm">
        {citaNotas && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500 dark:text-gray-400">Cliente:</span> <span className="font-medium dark:text-gray-200">{citaNotas.nombreCliente}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Servicio:</span> <span className="font-medium dark:text-gray-200">{citaNotas.nombreServicio}</span></p>
            </div>
            <div>
              <label htmlFor="nota-interna" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Nota interna <span className="text-gray-400 dark:text-gray-500">(solo visible para el negocio)</span>
              </label>
              <textarea
                id="nota-interna"
                value={notasTexto}
                onChange={(e) => setNotasTexto(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Preferencias del cliente, indicaciones especiales, alergias..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-slate-700 resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right mt-1">{notasTexto.length}/1000</p>
            </div>
            <div className="flex gap-2">
              {citaNotas.notas && (
                <button
                  onClick={() => actualizarNotas({ id: citaNotas.id, notas: null })}
                  disabled={guardandoNotas}
                  className="px-4 py-2.5 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 rounded-xl text-sm transition"
                >
                  Eliminar nota
                </button>
              )}
              <button
                onClick={() => actualizarNotas({ id: citaNotas.id, notas: notasTexto || null })}
                disabled={guardandoNotas || notasTexto === (citaNotas.notas ?? "")}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {guardandoNotas ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Nueva cita ── */}
      <Modal abierto={modalNueva} onCerrar={() => setModalNueva(false)} titulo={`Nueva ${terms.cita.toLowerCase()}`} ancho="md">
        {/* Paso 1 — Servicio, empleado, fecha, slot */}
        {pasoCita === 1 && (
          <div className="space-y-4">
            {/* Servicio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servicio</label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg divide-y divide-gray-100 dark:divide-slate-600">
                {servicios.filter((s) => s.activo).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSvcSel(s.id); setEmpSel(""); setFechaNueva(""); setSlotNuevo(""); }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition ${
                      svcSel === s.id
                        ? "bg-slate-700 text-white"
                        : "hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <span className="font-medium">{s.nombre}</span>
                    <span className={`ml-2 text-xs ${svcSel === s.id ? "text-slate-300" : "text-gray-400 dark:text-gray-500"}`}>
                      {s.duracionMinutos} min · {formatPrecio(s.precio)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Empleado */}
            {svcSel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profesional</label>
                {empleadosFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">Ningún empleado ofrece este servicio</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg divide-y divide-gray-100 dark:divide-slate-600">
                    {empleadosFiltrados.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => { setEmpSel(e.id); setFechaNueva(""); setSlotNuevo(""); }}
                        className={`w-full text-left px-3 py-2.5 text-sm transition ${
                          empSel === e.id
                            ? "bg-slate-700 text-white"
                            : "hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {e.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fecha */}
            {svcSel && empSel && (
              <div>
                <DatePicker
                  label="Fecha"
                  value={fechaNueva}
                  minDate={hoy()}
                  onChange={(v) => { setFechaNueva(v); setSlotNuevo(""); }}
                />
              </div>
            )}

            {/* Slots */}
            {svcSel && empSel && fechaNueva && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Horario disponible</label>
                {cargandoSlotsNueva ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">Cargando horarios...</p>
                ) : errorSlotsNueva ? (
                  <p className="text-xs text-red-500 text-center py-2">Error al cargar horarios. Intenta de nuevo.</p>
                ) : slotsNueva.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {slotsNueva.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotNuevo(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotNuevo === s.inicio
                            ? "bg-slate-700 text-white border-slate-700"
                            : "border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-slate-700 dark:hover:border-slate-400"
                        }`}
                      >
                        {s.horaTexto}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => slotNuevo && setPasoCita(2)}
              disabled={!slotNuevo}
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* Paso 2 — Datos del cliente */}
        {pasoCita === 2 && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500 dark:text-gray-400">Servicio:</span> <span className="font-medium dark:text-gray-200">{servicios.find((s) => s.id === svcSel)?.nombre}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Profesional:</span> <span className="font-medium dark:text-gray-200">{empleados.find((e) => e.id === empSel)?.nombre}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Hora:</span> <span className="font-medium dark:text-gray-200">{slotNuevo ? formatFechaHora(slotNuevo) : ""}</span></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del cliente <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={fCliente.nombre}
                onChange={(e) => setFCliente((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
              </label>
              <input
                type="tel"
                value={fCliente.telefono}
                onChange={(e) => setFCliente((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="10 dígitos"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional — para recordatorio)</span>
              </label>
              <input
                type="email"
                value={fCliente.email}
                onChange={(e) => {
                  setFCliente((p) => ({ ...p, email: e.target.value }));
                  if (emailClienteError) setEmailClienteError(validarEmailCliente(e.target.value));
                }}
                onBlur={() => setEmailClienteError(validarEmailCliente(fCliente.email))}
                placeholder="correo@ejemplo.com"
                className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 ${
                  emailClienteError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-slate-600"
                }`}
              />
              {emailClienteError && (
                <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} aria-hidden="true" /> {emailClienteError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nota interna <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
              </label>
              <textarea
                value={fCliente.notas}
                onChange={(e) => setFCliente((p) => ({ ...p, notas: e.target.value }))}
                rows={2}
                placeholder="Preferencias, indicaciones..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPasoCita(1)}
                className="px-4 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-sm transition"
              >
                ← Atrás
              </button>
              <button
                onClick={() => {
                  const err = validarEmailCliente(fCliente.email);
                  setEmailClienteError(err);
                  if (!err) crearCita();
                }}
                disabled={!fCliente.nombre.trim() || creando || !!emailClienteError}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {creando ? "Creando..." : `Crear ${terms.cita.toLowerCase()}`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Ver comprobante ── */}
      <Modal abierto={!!urlComprobante} onCerrar={() => setUrlComprobante(null)} titulo="Comprobante de anticipo" ancho="sm">
        {urlComprobante && (
          <div className="space-y-3">
            <img
              src={urlComprobante}
              alt="Comprobante de anticipo"
              className="w-full rounded-xl border border-gray-100 object-contain max-h-[60vh]"
            />
            <a
              href={urlComprobante}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm text-slate-700 hover:underline font-medium"
            >
              Abrir imagen completa →
            </a>
          </div>
        )}
      </Modal>

      {/* ── Hoja de acciones: calendario y Gantt ── */}
      <HojaAccionesCita
        cita={citaAcciones}
        onCerrar={() => setCitaAcciones(null)}
        accionesExtra={citaAcciones ? accionesExtra(citaAcciones) : []}
        nombreNegocio={nombreNegocio}
      />

      {/* ── Anular anticipo: cambia lo que se cobra al final ── */}
      <ConfirmarAccion
        abierto={!!citaAnularAnticipo}
        titulo="Anular anticipo"
        mensaje={citaAnularAnticipo && (
          <p>
            {`¿Anular el anticipo de ${formatPrecio(citaAnularAnticipo.montoAnticipo ?? 0)} de `}
            <strong className="text-foreground">{citaAnularAnticipo.nombreCliente}</strong>
            {"? Al cobrar ya no se descontará del total."}
          </p>
        )}
        etiquetaConfirmar="Anular anticipo"
        destructiva
        pendiente={mutAnticipo.isPending}
        onConfirmar={() => citaAnularAnticipo && mutAnticipo.mutate({ id: citaAnularAnticipo.id, recibido: false })}
        onCerrar={() => setCitaAnularAnticipo(null)}
      />

      {/* ── Confirmar reagendado por arrastre (solo escritorio) ── */}
      <ConfirmarAccion
        abierto={!!confirmDrag}
        titulo={`Reagendar ${terms.cita.toLowerCase()}`}
        mensaje={confirmDrag && (
          <p>
            {`¿Mover la ${terms.cita.toLowerCase()} de `}
            <strong className="text-foreground">{confirmDrag.nombre}</strong>
            {` para el ${confirmDrag.label}?`}
          </p>
        )}
        etiquetaConfirmar="Mover"
        onConfirmar={() => { if (confirmDrag) reagendar({ id: confirmDrag.id, inicioEn: confirmDrag.nuevoInicio }); setConfirmDrag(null); }}
        onCerrar={() => setConfirmDrag(null)}
      />

      {/* ── Modal: Repetir cita ── */}
      <Modal abierto={!!citaRepetir} onCerrar={() => setCitaRepetir(null)} titulo={`Repetir ${terms.cita.toLowerCase()}`} ancho="sm">
        {citaRepetir && (
          <>
            {/* Paso 1 — elegir nueva fecha y slot */}
            {pasoRepetir === 1 && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-gray-500 dark:text-gray-400">Servicio:</span> <span className="font-medium dark:text-gray-200">{citaRepetir.nombreServicio}</span></p>
                  <p><span className="text-gray-500 dark:text-gray-400">Profesional:</span> <span className="font-medium dark:text-gray-200">{citaRepetir.nombreEmpleado}</span></p>
                  <p><span className="text-gray-500 dark:text-gray-400">Cliente:</span> <span className="font-medium dark:text-gray-200">{citaRepetir.nombreCliente}</span></p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona la nueva fecha y horario:</p>
                <PasoFechaHora
                  servicioId={citaRepetir.servicioId}
                  empleadoId={citaRepetir.empleadoId}
                  seleccionado={slotRepetir}
                  onSeleccionar={setSlotRepetir}
                />
                <button
                  onClick={() => slotRepetir && setPasoRepetir(2)}
                  disabled={!slotRepetir}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
                >
                  Continuar →
                </button>
              </div>
            )}

            {/* Paso 2 — confirmar datos del cliente */}
            {pasoRepetir === 2 && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
                  <p><span className="text-gray-500 dark:text-gray-400">Servicio:</span> <span className="font-medium dark:text-gray-200">{citaRepetir.nombreServicio}</span></p>
                  <p><span className="text-gray-500 dark:text-gray-400">Profesional:</span> <span className="font-medium dark:text-gray-200">{citaRepetir.nombreEmpleado}</span></p>
                  <p><span className="text-gray-500 dark:text-gray-400">Hora:</span> <span className="font-medium dark:text-gray-200">{slotRepetir ? formatFechaHora(slotRepetir.inicio) : ""}</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del cliente <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={fClienteRepetir.nombre}
                    onChange={(e) => setFClienteRepetir((p) => ({ ...p, nombre: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono <span className="text-red-400">*</span></label>
                  <input
                    type="tel"
                    value={fClienteRepetir.telefono}
                    onChange={(e) => setFClienteRepetir((p) => ({ ...p, telefono: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    value={fClienteRepetir.email}
                    onChange={(e) => {
                      setFClienteRepetir((p) => ({ ...p, email: e.target.value }));
                      if (emailRepetirError) setEmailRepetirError(validarEmailCliente(e.target.value));
                    }}
                    onBlur={() => setEmailRepetirError(validarEmailCliente(fClienteRepetir.email))}
                    className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:bg-slate-800 dark:text-gray-100 ${
                      emailRepetirError ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-gray-200 dark:border-slate-600"
                    }`}
                  />
                  {emailRepetirError && (
                    <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} aria-hidden="true" /> {emailRepetirError}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nota interna <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={fClienteRepetir.notas}
                    onChange={(e) => setFClienteRepetir((p) => ({ ...p, notas: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPasoRepetir(1)}
                    className="px-4 py-2.5 border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl text-sm transition"
                  >
                    ← Atrás
                  </button>
                  <button
                    onClick={() => {
                      const err = validarEmailCliente(fClienteRepetir.email);
                      setEmailRepetirError(err);
                      if (!err) repetirCita();
                    }}
                    disabled={!fClienteRepetir.nombre.trim() || !fClienteRepetir.telefono.trim() || repitiendo || !!emailRepetirError}
                    className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
                  >
                    {repitiendo ? "Creando..." : `Crear ${terms.cita.toLowerCase()}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
