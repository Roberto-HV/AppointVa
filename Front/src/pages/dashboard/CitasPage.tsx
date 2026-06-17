import { useState } from "react";
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
import { useToastStore } from "../../store/toastStore";
import type { CitaDto, SlotDisponible } from "../../types";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { Tooltip } from "../../components/ui/Tooltip";
import { exportarExcel } from "../../utils/exportarExcel";
import { intakeApi } from "../../api/intake";
import { formatPrecio, formatFechaHoraCorta as formatFechaHora } from "../../utils/formatters";
import Pagination from "../../components/ui/Pagination";

const METODO_ICONO: Record<string, string> = {
  Efectivo: "💵",
  Tarjeta: "💳",
  Transferencia: "🏦",
};

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

  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [desde, setDesde] = useState(() => new Date().toISOString().split("T")[0]);
  const [hasta, setHasta] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [busqueda, setBusqueda] = useState("");
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

  // Modal nueva cita
  const [modalNueva, setModalNueva] = useState(false);
  const [pasoCita, setPasoCita] = useState<1 | 2>(1);
  const [svcSel, setSvcSel] = useState("");
  const [empSel, setEmpSel] = useState("");
  const [fechaNueva, setFechaNueva] = useState("");
  const [slotNuevo, setSlotNuevo] = useState("");
  const [fCliente, setFCliente] = useState({ nombre: "", telefono: "", email: "", notas: "" });

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: pagCitas, isLoading } = useQuery({
    queryKey: ["citas", desde, hasta, empleadoId, pagina],
    queryFn: () => citasApi.obtenerTodas({
      desde: desde || undefined,
      hasta: hasta || undefined,
      empleadoId: empleadoId || undefined,
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

  const { data: slotsNueva = [], isFetching: cargandoSlotsNueva } = useQuery({
    queryKey: ["slots-nueva", svcSel, empSel, fechaNueva],
    queryFn: async (): Promise<SlotDisponible[]> => {
      const { data } = await api.get("/publico/disponibilidad", {
        params: { servicioId: svcSel, empleadoId: empSel, fecha: fechaNueva },
      });
      return data;
    },
    enabled: !!svcSel && !!empSel && !!fechaNueva,
  });

  const { data: slotsReag = [], isFetching: cargandoSlots } = useQuery({
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
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaReag(null); setFechaReag(""); setSlotReag("");
      toast("Cita reagendada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo reagendar la cita";
      toast(msg);
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
      toast(msg);
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
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setModalNueva(false);
      setPasoCita(1);
      setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
      setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
      toast("Cita creada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo crear la cita";
      toast(msg);
    },
  });

  const abrirNuevaCita = () => {
    setModalNueva(true);
    setPasoCita(1);
    setSvcSel(""); setEmpSel(""); setFechaNueva(""); setSlotNuevo("");
    setFCliente({ nombre: "", telefono: "", email: "", notas: "" });
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

  const { mutate: cambiarEstado, isPending } = useMutation({
    mutationFn: ({ id, estado, mot }: { id: string; estado: number; mot: string }) =>
      citasApi.cambiarEstado(id, { nuevoEstado: estado, motivo: mot || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas"] });
      qc.invalidateQueries({ queryKey: ["citas-cal"] });
      qc.invalidateQueries({ queryKey: ["citas-badge"] });
      qc.invalidateQueries({ queryKey: ["dashboard-resumen"] });
      setCitaSel(null); setNuevoEstado(null); setMotivo("");
      toast("Estado actualizado");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "No se pudo cambiar el estado";
      toast(msg);
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

  const citasFiltradas = citas.filter((c) => {
    if (estadoFiltro && c.estadoTexto !== estadoFiltro) return false;
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      return (
        c.nombreCliente.toLowerCase().includes(q) ||
        c.telefonoCliente.includes(q) ||
        c.nombreServicio.toLowerCase().includes(q)
      );
    }
    return true;
  });

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
    const filas = citasFiltradas.map((c) => [
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
    <div className="p-4 sm:p-8">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
          {citasFiltradas.length > 0 && vista === "lista" && (
            <button
              onClick={exportarCSV}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition"
            >
              Exportar Excel
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={abrirNuevaCita}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition"
          >
            + Nueva cita
          </button>
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setVista("lista")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                vista === "lista" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setVista("calendario")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                vista === "calendario" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Calendario
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      {vista === "lista" && (
        <div className="grid grid-cols-2 gap-2 mb-6">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-gray-500 mb-1">Buscar cliente</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o teléfono..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Profesional</label>
            <Select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setPagina(1); }} className="w-full">
              <option value="">Todos</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </Select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1.5">Estado</label>
            <div className="flex flex-wrap gap-1.5">
              {(["", "Pendiente", "Confirmada", "Completada", "Cancelada", "Inasistencia"] as const).map((e) => {
                const count = e ? conteoEstados[e] : citas.length;
                return (
                  <button
                    key={e || "todos"}
                    onClick={() => setEstadoFiltro(e)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                      estadoFiltro === e
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-gray-600 border-gray-200 hover:border-slate-400"
                    }`}
                  >
                    {e || "Todos"}
                    {count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        estadoFiltro === e ? "bg-white/20" : "bg-gray-100"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700" />
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
          <label className="block text-xs text-gray-500 mb-1">Profesional</label>
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
            if (confirm(`¿Reagendar "${cita.nombreCliente}" para el ${nueva}?`)) {
              reagendar({ id: cita.id, inicioEn: nuevoInicio });
            }
          }}
        />
      )}

      {/* Vista lista */}
      {vista === "lista" && (
        isLoading ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody><SkeletonTableRows filas={6} columnas={5} /></tbody>
            </table>
          </div>
        ) : citasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Calendar size={26} className="text-gray-300" />
            </div>
            <div>
              <p className="font-medium text-gray-500">
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
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
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
                {citasFiltradas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{c.nombreCliente}</p>
                      <p className="text-xs text-gray-400">{c.telefonoCliente}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs sm:text-sm">{c.nombreServicio}</td>
                    <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{c.nombreEmpleado}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs sm:text-sm">{formatFechaHora(c.inicioEn)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800 hidden sm:table-cell">{formatPrecio(c.precio)}</td>

                    {/* Columna de pago — solo desktop */}
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <Tooltip text={c.pagada ? "Ver detalle o revertir el pago" : "Registrar el pago de esta cita"}>
                        <button
                          onClick={() => abrirPago(c)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition ${
                            c.pagada
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {c.pagada
                            ? `✓ ${c.metodoPago ?? "Pagado"}`
                            : "Cobrar"}
                        </button>
                      </Tooltip>
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
                          <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4">
                            <path d="M16.003 0C7.164 0 0 7.164 0 16.003c0 2.82.737 5.463 2.027 7.759L0 32l8.484-2.003A15.93 15.93 0 0016.003 32C24.836 32 32 24.836 32 16.003 32 7.164 24.836 0 16.003 0zm7.29 21.948c-.398-.2-2.362-1.166-2.728-1.3-.366-.133-.632-.2-.898.2-.267.4-1.032 1.3-1.265 1.566-.233.267-.466.3-.865.1-.398-.2-1.682-.62-3.204-1.977-1.184-1.056-1.984-2.36-2.216-2.758-.233-.4-.025-.616.174-.814.179-.179.4-.466.6-.7.2-.233.266-.4.4-.666.133-.267.066-.5-.033-.7-.1-.2-.898-2.162-1.232-2.96-.324-.778-.655-.672-.898-.684-.232-.013-.5-.013-.765-.013-.267 0-.7.1-1.065.5-.366.4-1.398 1.365-1.398 3.328s1.432 3.86 1.632 4.127c.2.267 2.818 4.302 6.825 6.03.953.414 1.698.66 2.279.844.958.306 1.83.263 2.52.16.769-.115 2.362-.965 2.695-1.897.333-.933.333-1.732.233-1.899-.1-.166-.366-.266-.765-.466z"/>
                          </svg>
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
                            <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5">
                              <path d="M16.003 0C7.164 0 0 7.164 0 16.003c0 2.82.737 5.463 2.027 7.759L0 32l8.484-2.003A15.93 15.93 0 0016.003 32C24.836 32 32 24.836 32 16.003 32 7.164 24.836 0 16.003 0zm7.29 21.948c-.398-.2-2.362-1.166-2.728-1.3-.366-.133-.632-.2-.898.2-.267.4-1.032 1.3-1.265 1.566-.233.267-.466.3-.865.1-.398-.2-1.682-.62-3.204-1.977-1.184-1.056-1.984-2.36-2.216-2.758-.233-.4-.025-.616.174-.814.179-.179.4-.466.6-.7.2-.233.266-.4.4-.666.133-.267.066-.5-.033-.7-.1-.2-.898-2.162-1.232-2.96-.324-.778-.655-.672-.898-.684-.232-.013-.5-.013-.765-.013-.267 0-.7.1-1.065.5-.366.4-1.398 1.365-1.398 3.328s1.432 3.86 1.632 4.127c.2.267 2.818 4.302 6.825 6.03.953.414 1.698.66 2.279.844.958.306 1.83.263 2.52.16.769-.115 2.362-.965 2.695-1.897.333-.933.333-1.732.233-1.899-.1-.166-.366-.266-.765-.466z"/>
                            </svg>
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
                              onClick={() => cambiarEstado({ id: c.id, estado: ESTADOS.Completada, mot: "" })}
                              disabled={isPending}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition"
                            >
                              ✓ Completar
                            </button>
                          </Tooltip>
                        )}
                        {(c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada") && (
                          <button
                            onClick={() => abrirReagendar(c)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition"
                          >
                            Reagendar
                          </button>
                        )}
                        {TRANSICIONES[c.estadoTexto] && (
                          <button
                            onClick={() => abrirCambioEstado(c)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-700/10 text-slate-700 hover:bg-slate-700/20 transition"
                          >
                            Más
                          </button>
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

      {/* ── Modal: Registrar / revertir pago ── */}
      <Modal abierto={!!citaPago} onCerrar={() => setCitaPago(null)} titulo="Pago de la cita" ancho="sm">
        {citaPago && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaPago.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaPago.nombreServicio}</span></p>
              <p><span className="text-gray-500">Total:</span> <span className="font-bold text-gray-900">{formatPrecio(citaPago.precio)}</span></p>
            </div>

            {citaPago.pagada ? (
              /* Ya pagada — mostrar info y opción de revertir */
              <>
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <span className="text-green-600 text-lg">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-green-700">Pago registrado</p>
                    {citaPago.metodoPago && (
                      <p className="text-xs text-green-600">
                        {METODO_ICONO[citaPago.metodoPago] ?? ""} {citaPago.metodoPago}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => marcarPagada({ id: citaPago.id, pagada: false })}
                  disabled={guardandoPago}
                  className="w-full border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 font-medium py-2.5 rounded-xl text-sm transition"
                >
                  {guardandoPago ? "Guardando..." : "Revertir pago"}
                </button>
              </>
            ) : (
              /* No pagada — seleccionar método */
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">¿Con qué método se pagó?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {METODOS_PAGO.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetodoPagoSel(m)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-medium transition ${
                          metodoPagoSel === m
                            ? "border-slate-700 bg-slate-700/5 text-slate-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-xl">{METODO_ICONO[m]}</span>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => metodoPagoSel && marcarPagada({ id: citaPago.id, pagada: true, metodo: metodoPagoSel })}
                  disabled={!metodoPagoSel || guardandoPago}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition"
                >
                  {guardandoPago ? "Guardando..." : "Confirmar pago"}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Modal: Notas internas ── */}
      <Modal abierto={!!citaNotas} onCerrar={() => setCitaNotas(null)} titulo="Nota interna" ancho="sm">
        {citaNotas && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaNotas.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaNotas.nombreServicio}</span></p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
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
      <Modal abierto={modalNueva} onCerrar={() => setModalNueva(false)} titulo="Nueva cita" ancho="sm">
        {/* Paso 1 — Servicio, empleado, fecha, slot */}
        {pasoCita === 1 && (
          <div className="space-y-4">
            {/* Servicio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
              <Select
                value={svcSel}
                onChange={(e) => { setSvcSel(e.target.value); setEmpSel(""); setFechaNueva(""); setSlotNuevo(""); }}
                className="w-full"
              >
                <option value="">— Selecciona un servicio —</option>
                {servicios.filter((s) => s.activo).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} · {s.duracionMinutos} min · {formatPrecio(s.precio)}
                  </option>
                ))}
              </Select>
            </div>

            {/* Empleado */}
            {svcSel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profesional</label>
                {empleadosFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-400">Ningún empleado ofrece este servicio</p>
                ) : (
                  <Select
                    value={empSel}
                    onChange={(e) => { setEmpSel(e.target.value); setFechaNueva(""); setSlotNuevo(""); }}
                    className="w-full"
                  >
                    <option value="">— Selecciona un profesional —</option>
                    {empleadosFiltrados.map((e) => (
                      <option key={e.id} value={e.id}>{e.nombre}</option>
                    ))}
                  </Select>
                )}
              </div>
            )}

            {/* Fecha */}
            {svcSel && empSel && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaNueva}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => { setFechaNueva(e.target.value); setSlotNuevo(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
                />
              </div>
            )}

            {/* Slots */}
            {svcSel && empSel && fechaNueva && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Horario disponible</label>
                {cargandoSlotsNueva ? (
                  <p className="text-sm text-gray-400">Cargando horarios...</p>
                ) : slotsNueva.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                    {slotsNueva.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotNuevo(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotNuevo === s.inicio
                            ? "bg-slate-700 text-white border-slate-700"
                            : "border-gray-200 text-gray-700 hover:border-slate-700"
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
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{servicios.find((s) => s.id === svcSel)?.nombre}</span></p>
              <p><span className="text-gray-500">Profesional:</span> <span className="font-medium">{empleados.find((e) => e.id === empSel)?.nombre}</span></p>
              <p><span className="text-gray-500">Hora:</span> <span className="font-medium capitalize">{slotNuevo ? formatFechaHora(slotNuevo) : ""}</span></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del cliente <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={fCliente.nombre}
                onChange={(e) => setFCliente((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-red-400">*</span></label>
              <input
                type="tel"
                value={fCliente.telefono}
                onChange={(e) => setFCliente((p) => ({ ...p, telefono: e.target.value }))}
                placeholder="10 dígitos"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(opcional — para recordatorio)</span>
              </label>
              <input
                type="email"
                value={fCliente.email}
                onChange={(e) => setFCliente((p) => ({ ...p, email: e.target.value }))}
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nota interna <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={fCliente.notas}
                onChange={(e) => setFCliente((p) => ({ ...p, notas: e.target.value }))}
                rows={2}
                placeholder="Preferencias, indicaciones..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPasoCita(1)}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm transition"
              >
                ← Atrás
              </button>
              <button
                onClick={() => crearCita()}
                disabled={!fCliente.nombre.trim() || !fCliente.telefono.trim() || creando}
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
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaReag.nombreCliente}</span></p>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaReag.nombreServicio}</span></p>
              <p><span className="text-gray-500">Actual:</span> <span className="font-medium capitalize">{formatFechaHora(citaReag.inicioEn)}</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva fecha</label>
              <input
                type="date"
                value={fechaReag}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => { setFechaReag(e.target.value); setSlotReag(""); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
              />
            </div>
            {fechaReag && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo horario</label>
                {cargandoSlots ? (
                  <p className="text-sm text-gray-400">Cargando horarios disponibles...</p>
                ) : slotsReag.length === 0 ? (
                  <p className="text-sm text-gray-400">Sin horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {slotsReag.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotReag(s.inicio)}
                        className={`py-2 text-sm rounded-lg border transition ${
                          slotReag === s.inicio
                            ? "bg-violet-600 text-white border-violet-600"
                            : "border-gray-200 text-gray-700 hover:border-violet-400"
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
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <p><span className="text-gray-500">Cliente:</span> <span className="font-medium">{citaSel.nombreCliente}</span></p>
                <Link
                  to={`/dashboard/clientes?clienteId=${citaSel.clienteId}`}
                  className="text-xs text-slate-700 hover:underline font-medium shrink-0 ml-2"
                  onClick={() => setCitaSel(null)}
                >
                  Ver historial
                </Link>
              </div>
              <p><span className="text-gray-500">Servicio:</span> <span className="font-medium">{citaSel.nombreServicio}</span></p>
              <p><span className="text-gray-500">Hora:</span> <span className="font-medium capitalize">{formatFechaHora(citaSel.inicioEn)}</span></p>
              <p><span className="text-gray-500">Estado actual:</span> <span className="font-medium">{citaSel.estadoTexto}</span></p>
              {respuestasIntake.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Preguntas de intake</p>
                  {respuestasIntake.map((r, i) => (
                    <p key={i}>
                      <span className="text-gray-500">{r.etiqueta}:</span>{" "}
                      <span className="font-medium">{r.valor ?? "—"}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            {accionesCita.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-2">Esta cita no puede cambiar de estado.</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700 mb-3">Selecciona el nuevo estado:</p>
                <div className="space-y-2 mb-4">
                  {accionesCita.map((acc) => (
                    <button key={acc.estado} onClick={() => setNuevoEstado(acc.estado)}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition border-2 ${
                        nuevoEstado === acc.estado
                          ? "border-gray-800 " + acc.clase
                          : "border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}>
                      {acc.label}
                    </button>
                  ))}
                </div>
                {(nuevoEstado === ESTADOS.Cancelada || nuevoEstado === ESTADOS.Inasistencia) && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Motivo <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)}
                      rows={2} placeholder="Motivo de la cancelación..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none" />
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
    </div>
  );
}
