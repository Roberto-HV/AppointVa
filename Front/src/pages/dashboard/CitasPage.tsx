import { useState, useEffect } from "react";
import { SiWhatsapp } from "react-icons/si";

function fechaStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function hoy() { return fechaStr(new Date()); }
function inicioSemana() {
  const d = new Date();
  const diff = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return fechaStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff));
}
function finSemana() {
  const d = new Date();
  const diff = d.getDay() === 0 ? 0 : 7 - d.getDay();
  return fechaStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}
function inicioMes() {
  const d = new Date();
  return fechaStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
function finMes() {
  const d = new Date();
  return fechaStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
import { Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { citasApi, ESTADOS, METODOS_PAGO } from "../../api/citas";
import Select from "../../components/ui/Select";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { negociosApi } from "../../api/negocios";
import { api } from "../../api/axios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import Modal from "../../components/ui/Modal";
import CalendarioCitas from "../../components/dashboard/CalendarioCitas";
import GanttCitas from "../../components/dashboard/GanttCitas";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import { useToastStore } from "../../store/toastStore";
import type { CitaDto, SlotDisponible } from "../../types";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { Tooltip } from "../../components/ui/Tooltip";
import { exportarExcel } from "../../utils/exportarExcel";
import { intakeApi } from "../../api/intake";
import { formatPrecio, formatFechaHoraCorta as formatFechaHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";
import { useModuloPagos } from "../../hooks/useModuloPagos";


const TRANSICIONES: Record<string, { label: string; estado: number; clase: string }[]> = {
  Pendiente: [
    { label: "Confirmar",    estado: ESTADOS.Confirmada,   clase: "bg-green-500 text-white" },
    { label: "Cancelar",     estado: ESTADOS.Cancelada,    clase: "bg-red-500 text-white" },
  ],
  Confirmada: [
    { label: "Completar",    estado: ESTADOS.Completada,   clase: "bg-blue-500 text-white" },
    { label: "Inasistencia", estado: ESTADOS.Inasistencia, clase: "bg-gray-500 text-white" },
    { label: "Cancelar",     estado: ESTADOS.Cancelada,    clase: "bg-red-500 text-white" },
  ],
};

export default function CitasPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const { habilitado: moduloPagosActivo } = useModuloPagos();

  const [vista, setVista] = useState<"lista" | "calendario" | "gantt">("lista");
  const [desde, setDesde] = useState(() => hoy());
  const [hasta, setHasta] = useState(() => hoy());
  const [empleadoId, setEmpleadoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaQuery, setBusquedaQuery] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const TAMANO = 50;

  // Modal cambiar estado
  const [citaSel, setCitaSel] = useState<CitaDto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [nuevoEstado, setNuevoEstado] = useState<number | null>(null);

  // Modal reagendar
  const [citaReag, setCitaReag] = useState<CitaDto | null>(null);
  const [fechaReag, setFechaReag] = useState("");
  const [slotReag, setSlotReag] = useState("");

  // Modal pago
  const [citaPago, setCitaPago] = useState<CitaDto | null>(null);
  const [metodoPagoSel, setMetodoPagoSel] = useState<string>("");

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

  // Issue 12 — drag-to-reschedule confirmation
  const [confirmDrag, setConfirmDrag] = useState<{id: string; nombre: string; nuevoInicio: string; label: string} | null>(null);

  // Issue 15 — completar confirmation
  const [confirmCompletar, setConfirmCompletar] = useState<string | null>(null);
  const validarEmailCliente = (v: string) =>
    v.trim() && !EMAIL_RE.test(v.trim()) ? "Correo no válido (ej: nombre@dominio.com)" : "";

  // Debounce búsqueda 400ms para no disparar una request por cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setBusquedaQuery(busqueda); setPagina(1); }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const estadoNum = estadoFiltro ? ESTADOS[estadoFiltro as keyof typeof ESTADOS] : undefined;

  const { data: pagCitas, isLoading } = useQuery({
    queryKey: ["citas", desde, hasta, empleadoId, busquedaQuery, estadoFiltro, pagina],
    queryFn: () => citasApi.obtenerTodas({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
      busqueda: busquedaQuery || undefined,
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

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios"],
    queryFn: serviciosApi.obtenerTodos,
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

  const { data: slotsReag = [], isFetching: cargandoSlots, isError: errorSlotsReag } = useQuery({
    queryKey: ["slots-reag", citaReag?.id, fechaReag],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: citaReag!.servicioId, empleadoId: citaReag!.empleadoId, fecha: fechaReag },
      });
      return data;
    },
    enabled: !!citaReag && !!fechaReag,
  });

  const { data: respuestasIntake = [] } = useQuery({
    queryKey: ["intake-respuestas", citaSel?.id],
    queryFn: () => intakeApi.getRespuestas(citaSel!.id),
    enabled: !!citaSel,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: reagendar, isPending: reagendando } = useMutation({
    mutationFn: ({ id, inicioEn }: { id: string; inicioEn: string }) =>
      citasApi.reagendar(id, inicioEn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaReag(null); setFechaReag(""); setSlotReag("");
      toast("Cita reagendada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo reagendar la cita";
      toast(msg, "error");
    },
  });

  const { mutate: marcarPagada, isPending: guardandoPago } = useMutation({
    mutationFn: ({ id, pagada, metodo }: { id: string; pagada: boolean; metodo?: string }) =>
      citasApi.marcarPagada(id, pagada, metodo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaPago(null);
      setMetodoPagoSel("");
      toast("Estado de pago actualizado");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo actualizar el pago";
      toast(msg, "error");
    },
  });

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
      toast("Cita creada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo crear la cita";
      toast(msg, "error");
    },
  });

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
      toast("Cita creada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "No se pudo crear la cita";
      toast(msg, "error");
    },
  });

  const { mutate: cambiarEstado, isPending } = useMutation({
    mutationFn: ({ id, estado, mot }: { id: string; estado: number; mot: string }) =>
      citasApi.cambiarEstado(id, { nuevoEstado: estado, motivo: mot || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["citas-gantt"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaSel(null); setNuevoEstado(null); setMotivo("");
      toast("Estado actualizado");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo cambiar el estado";
      toast(msg, "error");
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const abrirReagendar = (c: CitaDto) => { setCitaReag(c); setFechaReag(""); setSlotReag(""); };
  const abrirCambioEstado = (c: CitaDto) => { setCitaSel(c); setNuevoEstado(null); setMotivo(""); };

  const abrirPago = (c: CitaDto) => {
    setCitaPago(c);
    setMetodoPagoSel(c.metodoPago ?? "");
  };

  const abrirNotas = (c: CitaDto) => {
    setCitaNotas(c);
    setNotasTexto(c.notas ?? "");
  };

  const accionesCita = citaSel ? TRANSICIONES[citaSel.estadoTexto] ?? [] : [];

  const conteoEstados = citas.reduce<Record<string, number>>((acc, c) => {
    acc[c.estadoTexto] = (acc[c.estadoTexto] ?? 0) + 1;
    return acc;
  }, {});

  // ── WhatsApp ─────────────────────────────────────────────────────────────────
  const whatsappUrl = (c: CitaDto) => {
    const tel = c.telefonoCliente.replace(/\D/g, "");
    const negocio = nombreNegocio ? ` en *${nombreNegocio}*` : "";
    const msg =
      `Hola ${c.nombreCliente} 👋, te recordamos tu cita${negocio}:\n\n` +
      `📌 *Servicio:* ${c.nombreServicio}\n` +
      `👤 *Con:* ${c.nombreEmpleado}\n` +
      `📅 *Fecha:* ${formatFechaHora(c.inicioEn)}\n` +
      `💰 *Total:* ${formatPrecio(c.precio)}\n\n` +
      `¡Te esperamos!`;
    return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
  };

  // ── Excel export ─────────────────────────────────────────────────────────────
  const exportarCSV = () => {
    const encabezados = ["Fecha", "Cliente", "Teléfono", "Servicio", "Profesional", "Precio", "Estado", "Pagada", "Método de pago", "Notas"];
    const filas = citas.map((c) => [
      new Date(c.inicioEn).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }),
      c.nombreCliente,
      c.telefonoCliente ?? "",
      c.nombreServicio,
      c.nombreEmpleado,
      `$${c.precio.toFixed(2)}`,
      c.estadoTexto,
      c.pagada ? "Sí" : "No",
      c.metodoPago ?? "",
      c.notas ?? "",
    ]);
    exportarExcel(encabezados, [filas], "citas", "Reporte de Citas");
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8 overflow-x-hidden">
      {/* Encabezado */}
      <div className="mb-6 space-y-3">

        {/* Fila 1 — título + acciones desktop */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Citas</h1>
          <div className="flex items-center gap-2">
            {/* Recepción y Exportar: solo desktop */}
            <Link
              to="/dashboard/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex p-2 text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300 rounded-lg transition items-center gap-1.5 text-xs font-medium"
            >
              🖥 Recepción
            </Link>
            {citas.length > 0 && vista === "lista" && (
              <button
                onClick={exportarCSV}
                className="hidden sm:block text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
              >
                Exportar Excel
              </button>
            )}
            <button
              onClick={abrirNuevaCita}
              className="whitespace-nowrap px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition"
            >
              + Nueva cita
            </button>
          </div>
        </div>

        {/* Fila 2 — tabs: ancho completo en móvil, auto en desktop */}
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1 gap-1">
          <button
            onClick={() => setVista("lista")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
              vista === "lista" ? "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Lista
          </button>
          <button
            onClick={() => setVista("calendario")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
              vista === "calendario" ? "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Calendario
          </button>
          <button
            onClick={() => setVista("gantt")}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
              vista === "gantt" ? "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Línea de tiempo
          </button>
        </div>

      </div>

      {/* Filtros */}
      {vista === "lista" && (
        <div className="grid grid-cols-2 gap-2 mb-6 min-w-0">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Buscar cliente</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o teléfono..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Profesional</label>
            <Select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setPagina(1); }} className="w-full">
              <option value="">Todos</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Estado</label>
            <div className="flex flex-wrap gap-1.5">
              {(["", "Pendiente", "Confirmada", "Completada", "Cancelada", "Inasistencia"] as const).map((e) => {
                const count = e ? conteoEstados[e] : citas.length;
                return (
                  <button
                    key={e || "todos"}
                    onClick={() => { setEstadoFiltro(e); setPagina(1); }}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                      estadoFiltro === e
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {e || "Todos"}
                    {count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        estadoFiltro === e ? "bg-white/20" : "bg-gray-100 dark:bg-slate-700"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Atajos rápidos de fecha */}
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Período</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { label: "Hoy",    d: hoy(),        h: hoy() },
                { label: "Semana", d: inicioSemana(), h: finSemana() },
                { label: "Mes",    d: inicioMes(),   h: finMes() },
              ] as const).map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setDesde(p.d); setHasta(p.h); setPagina(1); }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition ${
                    desde === p.d && hasta === p.h
                      ? "bg-slate-700 text-white border-slate-700"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-600 hover:border-slate-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Desde</label>
              <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
                style={{ width: '100%', minWidth: 0, WebkitAppearance: 'none' }} />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
                style={{ width: '100%', minWidth: 0, WebkitAppearance: 'none' }} />
            </div>
          </div>
          {(desde || hasta || empleadoId || busqueda || estadoFiltro) && (
            <div className="col-span-2 flex">
              <button onClick={() => { setDesde(""); setHasta(""); setEmpleadoId(""); setBusqueda(""); setEstadoFiltro(""); setPagina(1); }}
                className="text-sm text-slate-700 font-medium hover:underline">
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
      {vista === "calendario" && empleados.length > 1 && (
        <div className="mb-4">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Profesional</label>
          <Select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Select>
        </div>
      )}

      {/* Vista calendario */}
      {vista === "calendario" && (
        <CalendarioCitas
          empleadoId={empleadoId}
          onCitaClick={abrirCambioEstado}
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
        <GanttCitas onCitaClick={abrirCambioEstado} />
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
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <Calendar size={26} className="text-gray-300" />
            </div>
            <div>
              <p className="font-medium text-gray-500 dark:text-gray-400">
                {estadoFiltro ? `Sin citas ${estadoFiltro.toLowerCase()}s` : "No hay citas en este rango"}
              </p>
              {(estadoFiltro || busqueda) && (
                <button
                  onClick={() => { setEstadoFiltro(""); setBusqueda(""); }}
                  className="mt-2 text-sm text-slate-700 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Servicio</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Profesional</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha y hora</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Precio</th>
                  <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Pago</th>
                  <th className="text-center px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody>
                {citas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{c.nombreCliente}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{c.telefonoCliente}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs sm:text-sm">{c.nombreServicio}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{c.nombreEmpleado}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs sm:text-sm">{formatFechaHora(c.inicioEn)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200 hidden sm:table-cell">{formatPrecio(c.precio)}</td>

                    {/* Columna de pago — solo lectura */}
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {c.pagada ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                          ✓ {c.metodoPago ?? "Pagado"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Por pagar</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <EstadoBadge estado={c.estadoTexto} />
                        {c.comprobanteUrl && c.estadoTexto === "Pendiente" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">
                            🧾
                          </span>
                        )}
                        {/* WhatsApp — solo móvil */}
                        <a
                          href={whatsappUrl(c)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Enviar WhatsApp a ${c.nombreCliente}`}
                          className="sm:hidden inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition"
                        >
                          <SiWhatsapp size={16} />
                        </a>
                        {/* Botón de acciones — solo móvil */}
                        {TRANSICIONES[c.estadoTexto] && (
                          <button
                            onClick={() => abrirCambioEstado(c)}
                            className="sm:hidden text-gray-400 hover:text-gray-700 p-1 rounded transition text-base leading-none"
                            title="Cambiar estado"
                          >
                            ⋮
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Acciones — solo desktop */}
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {confirmCompletar === c.id && (
                        <div className="flex items-center gap-2 mt-2 text-xs justify-end mb-2">
                          <span className="text-gray-500 dark:text-gray-400">¿Marcar como completada?</span>
                          <button onClick={() => { cambiarEstado({ id: c.id, estado: ESTADOS.Completada, mot: "" }); setConfirmCompletar(null); }} className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition">Sí</button>
                          <button onClick={() => setConfirmCompletar(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1">No</button>
                        </div>
                      )}
                      <div className="flex justify-end items-center gap-2">
                        {/* WhatsApp */}
                        <Tooltip text="Enviar recordatorio por WhatsApp">
                          <a
                            href={whatsappUrl(c)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Enviar WhatsApp a ${c.nombreCliente}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition"
                          >
                            <SiWhatsapp size={14} />
                          </a>
                        </Tooltip>
                        <Tooltip text={c.notas ? "Ver o editar notas internas" : "Agregar una nota interna"}>
                          <button
                            onClick={() => abrirNotas(c)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition ${
                              c.notas
                                ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                          >
                            📝
                          </button>
                        </Tooltip>
                        {c.comprobanteUrl && (
                          <Tooltip text="Ver comprobante de anticipo">
                            <button
                              onClick={() => setUrlComprobante(c.comprobanteUrl!)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition"
                            >
                              🧾
                            </button>
                          </Tooltip>
                        )}
                        {c.estadoTexto === "Pendiente" && (
                          <Tooltip text="Confirmar esta cita directamente">
                            <button
                              onClick={() => cambiarEstado({ id: c.id, estado: ESTADOS.Confirmada, mot: "" })}
                              disabled={isPending}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-40 transition"
                            >
                              ✓ Confirmar
                            </button>
                          </Tooltip>
                        )}
                        {c.estadoTexto === "Confirmada" && (
                          <Tooltip text="Marcar como completada directamente">
                            <button
                              onClick={() => setConfirmCompletar(c.id)}
                              disabled={isPending}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60 dark:border dark:border-blue-500/60 disabled:opacity-40 transition"
                            >
                              ✓ Completar
                            </button>
                          </Tooltip>
                        )}
                        {(c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada") && (
                          <Tooltip text="Mover la cita a otra fecha u hora">
                            <button
                              onClick={() => abrirReagendar(c)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 dark:bg-violet-900/40 dark:text-violet-400 dark:hover:bg-violet-900/60 dark:border dark:border-violet-500/60 transition"
                            >
                              Reagendar
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip text="Crear una nueva cita con los mismos datos del cliente y servicio">
                          <button
                            onClick={() => abrirRepetirCita(c)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-900/60 dark:border dark:border-sky-500/60 transition"
                          >
                            Repetir
                          </button>
                        </Tooltip>
                        {TRANSICIONES[c.estadoTexto] && (
                          <Tooltip text="Ver más opciones de estado para esta cita">
                            <button
                              onClick={() => abrirCambioEstado(c)}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-700/10 text-slate-700 hover:bg-slate-700/20 dark:bg-slate-600/30 dark:text-slate-300 dark:hover:bg-slate-600/50 dark:border dark:border-slate-500 transition"
                            >
                              Más
                            </button>
                          </Tooltip>
                        )}
                      </div>
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


      {/* ── Modal: Notas internas ── */}
      <Modal abierto={!!citaNotas} onCerrar={() => setCitaNotas(null)} titulo="Nota interna" ancho="sm">
        {citaNotas && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaNotas.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaNotas.nombreServicio}</span></p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Nota interna <span className="text-gray-400">(solo visible para el negocio)</span>
              </label>
              <textarea
                value={notasTexto}
                onChange={(e) => setNotasTexto(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Preferencias del cliente, indicaciones especiales, alergias..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{notasTexto.length}/1000</p>
            </div>
            <div className="flex gap-2">
              {citaNotas.notas && (
                <button
                  onClick={() => actualizarNotas({ id: citaNotas.id, notas: null })}
                  disabled={guardandoNotas}
                  className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-xl text-sm transition"
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
      <Modal abierto={modalNueva} onCerrar={() => setModalNueva(false)} titulo="Nueva cita" ancho="md">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaNueva}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => { setFechaNueva(e.target.value); setSlotNuevo(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
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
              <p><span className="text-gray-500 dark:text-gray-400">Hora:</span> <span className="font-medium dark:text-gray-200 capitalize">{slotNuevo ? formatFechaHora(slotNuevo) : ""}</span></p>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono <span className="text-red-400">*</span></label>
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
                  emailClienteError ? "border-red-400 bg-red-50" : "border-gray-200 dark:border-slate-600"
                }`}
              />
              {emailClienteError && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <span>⚠</span> {emailClienteError}
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
                disabled={!fCliente.nombre.trim() || !fCliente.telefono.trim() || creando || !!emailClienteError}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition"
              >
                {creando ? "Creando..." : "Crear cita"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Reagendar ── */}
      <Modal abierto={!!citaReag} onCerrar={() => setCitaReag(null)} titulo="Reagendar cita" ancho="sm">
        {citaReag && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500 dark:text-gray-400">Cliente:</span> <span className="font-medium dark:text-gray-200">{citaReag.nombreCliente}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Servicio:</span> <span className="font-medium dark:text-gray-200">{citaReag.nombreServicio}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Actual:</span> <span className="font-medium dark:text-gray-200 capitalize">{formatFechaHora(citaReag.inicioEn)}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva fecha</label>
              <input
                type="date"
                value={fechaReag}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => { setFechaReag(e.target.value); setSlotReag(""); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700"
              />
            </div>
            {fechaReag && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nuevo horario</label>
                {cargandoSlots ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">Cargando horarios disponibles...</p>
                ) : errorSlotsReag ? (
                  <p className="text-xs text-red-500 text-center py-2">Error al cargar horarios. Intenta de nuevo.</p>
                ) : slotsReag.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {slotsReag.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotReag(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotReag === s.inicio
                            ? "bg-violet-600 text-white border-violet-600"
                            : "border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-violet-400 dark:hover:border-violet-500"
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
              onClick={() => slotReag && reagendar({ id: citaReag.id, inicioEn: slotReag })}
              disabled={!slotReag || reagendando}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
            >
              {reagendando ? "Reagendando..." : "Confirmar reagendado"}
            </button>
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

      {/* ── Modal: Cambiar estado ── */}
      <Modal abierto={!!citaSel} onCerrar={() => setCitaSel(null)} titulo="Cambiar estado de la cita" ancho="sm">
        {citaSel && (
          <div>
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 mb-5 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <p><span className="text-gray-500 dark:text-gray-400">Cliente:</span> <span className="font-medium dark:text-gray-200">{citaSel.nombreCliente}</span></p>
                <Link
                  to={`/dashboard/clientes?clienteId=${citaSel.clienteId}`}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:underline font-medium shrink-0 ml-2"
                  onClick={() => setCitaSel(null)}
                >
                  Ver historial
                </Link>
              </div>
              <p><span className="text-gray-500 dark:text-gray-400">Servicio:</span> <span className="font-medium dark:text-gray-200">{citaSel.nombreServicio}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Hora:</span> <span className="font-medium dark:text-gray-200 capitalize">{formatFechaHora(citaSel.inicioEn)}</span></p>
              <p><span className="text-gray-500 dark:text-gray-400">Estado actual:</span> <span className="font-medium dark:text-gray-200">{citaSel.estadoTexto}</span></p>
              {respuestasIntake.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-600 space-y-1">
                  <p className="text-gray-400 dark:text-gray-500 text-xs font-medium uppercase tracking-wide">Preguntas de intake</p>
                  {respuestasIntake.map((r, i) => (
                    <p key={i}>
                      <span className="text-gray-500 dark:text-gray-400">{r.etiqueta}:</span>{" "}
                      <span className="font-medium dark:text-gray-200">{r.valor ?? "—"}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            {accionesCita.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">Esta cita no puede cambiar de estado.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Selecciona el nuevo estado:</p>
                <div className="space-y-2 mb-4">
                  {accionesCita.map((acc) => (
                    <button key={acc.estado} onClick={() => setNuevoEstado(acc.estado)}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition border-2 ${
                        nuevoEstado === acc.estado
                          ? "border-gray-800 " + acc.clase
                          : "border-transparent bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                      }`}>
                      {acc.label}
                    </button>
                  ))}
                </div>
                {(nuevoEstado === ESTADOS.Cancelada || nuevoEstado === ESTADOS.Inasistencia) && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Motivo <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional)</span>
                    </label>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                      rows={2} placeholder="Motivo de la cancelación..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 text-sm outline-none focus:border-slate-700 resize-none" />
                  </div>
                )}
                <button
                  onClick={() => nuevoEstado && cambiarEstado({ id: citaSel.id, estado: nuevoEstado, mot: motivo })}
                  disabled={!nuevoEstado || isPending}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition">
                  {isPending ? "Guardando..." : "Confirmar cambio"}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirm drag reagendar ── */}
      {confirmDrag && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Reagendar cita</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">¿Mover la cita de <strong>{confirmDrag.nombre}</strong> para el {confirmDrag.label}?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDrag(null)} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition">Cancelar</button>
              <button onClick={() => { reagendar({ id: confirmDrag.id, inicioEn: confirmDrag.nuevoInicio }); setConfirmDrag(null); }} className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Repetir cita ── */}
      <Modal abierto={!!citaRepetir} onCerrar={() => setCitaRepetir(null)} titulo="Repetir cita" ancho="sm">
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
                  <p><span className="text-gray-500 dark:text-gray-400">Hora:</span> <span className="font-medium dark:text-gray-200 capitalize">{slotRepetir ? formatFechaHora(slotRepetir.inicio) : ""}</span></p>
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
                      emailRepetirError ? "border-red-400 bg-red-50" : "border-gray-200 dark:border-slate-600"
                    }`}
                  />
                  {emailRepetirError && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <span>⚠</span> {emailRepetirError}
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
                    {repitiendo ? "Creando..." : "Crear cita"}
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
