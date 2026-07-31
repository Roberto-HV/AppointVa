import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Clock, CheckCircle2, Circle, Banknote, Building2,
  RotateCcw, Download, Search, TrendingUp, AlertCircle, Receipt,
} from "lucide-react";
import { citasApi, METODOS_PAGO } from "../../api/citas";
import { pagosApi } from "../../api/pagos";
import { negociosApi } from "../../api/negocios";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { exportarExcel } from "../../utils/exportarExcel";
import Modal from "../../components/ui/Modal";
import TicketRecibo from "../../components/dashboard/TicketRecibo";
import type { CitaDto } from "../../types";

type FiltroEstadoPago = "todas" | "pendientes" | "pagadas";
type FiltroPeriodo = "hoy" | "semana" | "mes";
type Tab = "cobro" | "historial";

const hoy = () => new Date().toISOString().slice(0, 10);
const inicioSemana = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
};
const finSemana = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? 0 : 7 - day));
  return d.toISOString().slice(0, 10);
};
const inicioMes = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
const finMes = () =>
  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

const PERIODOS: { key: FiltroPeriodo; label: string; desde: () => string; hasta: () => string }[] = [
  { key: "hoy",    label: "Hoy",    desde: hoy,          hasta: hoy },
  { key: "semana", label: "Semana", desde: inicioSemana, hasta: finSemana },
  { key: "mes",    label: "Mes",    desde: inicioMes,    hasta: finMes },
];

const METODO_ICONO: Record<string, React.ReactNode> = {
  Efectivo:      <Banknote   size={16} strokeWidth={1.5} />,
  Tarjeta:       <CreditCard size={16} strokeWidth={1.5} />,
  Transferencia: <Building2  size={16} strokeWidth={1.5} />,
};

const METODO_ICONO_LG: Record<string, React.ReactNode> = {
  Efectivo:      <Banknote   size={20} strokeWidth={1.5} />,
  Tarjeta:       <CreditCard size={20} strokeWidth={1.5} />,
  Transferencia: <Building2  size={20} strokeWidth={1.5} />,
};

export default function PagosPage() {
  const qc = useQueryClient();
  const { usuario } = useAuthStore();
  const { toast } = useToastStore();
  const esEmpleado = usuario?.rol === "Empleado";

  // ── Tab ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("cobro");

  // ── Cobro tab state ───────────────────────────────────────────────────────
  const [periodo,       setPeriodo]       = useState<FiltroPeriodo>("hoy");
  const [filtroPago,    setFiltroPago]    = useState<FiltroEstadoPago>("pendientes");
  const [busquedaCobro, setBusquedaCobro] = useState("");
  const [citaSel,       setCitaSel]       = useState<CitaDto | null>(null);
  const [metodoPago,    setMetodoPago]    = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [propina,       setPropina]       = useState("");
  const [citaPagada,    setCitaPagada]    = useState<CitaDto | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // ── Historial tab state ───────────────────────────────────────────────────
  const [histDesde,     setHistDesde]     = useState(inicioMes);
  const [histHasta,     setHistHasta]     = useState(hoy);
  const [busquedaHist,  setBusquedaHist]  = useState("");

  const periodoActivo = PERIODOS.find((p) => p.key === periodo)!;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pagina, isLoading: cobroLoading } = useQuery({
    queryKey: ["citas-pagos", periodo],
    queryFn: () =>
      citasApi.obtenerTodas({
        desde: periodoActivo.desde(),
        hasta: periodoActivo.hasta(),
        pagina: 1,
        tamano: 200,
      }),
  });

  const { data: historialData = [], isLoading: histLoading } = useQuery({
    queryKey: ["historial-pagos", histDesde, histHasta],
    queryFn: () => citasApi.obtenerHistorialPagos({ desde: histDesde, hasta: histHasta }),
    enabled: tab === "historial",
  });

  // ── Cobro derived data ────────────────────────────────────────────────────
  const todas = pagina?.datos ?? [];

  const totalCobrado   = todas.filter(c => c.pagada).reduce((s, c) => s + (c.montoCobrado ?? c.precio), 0);
  const totalPendiente = todas.filter(c => !c.pagada).reduce((s, c) => s + c.precio, 0);
  const citasPagadas   = todas.filter(c => c.pagada).length;
  const totalCitas     = todas.length;

  const desglose = METODOS_PAGO.reduce<Record<string, number>>((acc, m) => {
    acc[m] = todas.filter(c => c.pagada && c.metodoPago === m)
      .reduce((s, c) => s + (c.montoCobrado ?? c.precio), 0);
    return acc;
  }, {});

  const citasFiltradas = useMemo(() => {
    let lista = todas;
    if (filtroPago === "pendientes") lista = lista.filter(c => !c.pagada);
    if (filtroPago === "pagadas")    lista = lista.filter(c => c.pagada);
    if (busquedaCobro.trim()) {
      const q = busquedaCobro.trim().toLowerCase();
      lista = lista.filter(c => c.nombreCliente.toLowerCase().includes(q));
    }
    return lista;
  }, [todas, filtroPago, busquedaCobro]);

  // ── Historial derived data ────────────────────────────────────────────────
  const histFiltrado = useMemo(() => {
    if (!busquedaHist.trim()) return historialData;
    const q = busquedaHist.trim().toLowerCase();
    return historialData.filter(c => c.nombreCliente.toLowerCase().includes(q));
  }, [historialData, busquedaHist]);

  const histTotalCobrado  = histFiltrado.reduce((s, c) => s + (c.montoCobrado ?? c.precio), 0);
  const histTotalPropinas = histFiltrado.reduce((s, c) => s + (c.propina ?? 0), 0);

  const histDesglose = METODOS_PAGO.reduce<Record<string, number>>((acc, m) => {
    acc[m] = histFiltrado.filter(c => c.metodoPago === m)
      .reduce((s, c) => s + (c.montoCobrado ?? c.precio), 0);
    return acc;
  }, {});

  // ── Mutations ─────────────────────────────────────────────────────────────
  const mutPagar = useMutation({
    mutationFn: (payload: { id: string; montoRec: number; prop: number }) =>
      pagosApi.registrar(payload.id, {
        pagada: true,
        metodoPago,
        montoCobrado: citaSel?.precio,
        montoRecibido: metodoPago === "Efectivo" ? payload.montoRec : undefined,
        cambio:
          metodoPago === "Efectivo" && payload.montoRec > (citaSel?.precio ?? 0)
            ? payload.montoRec - (citaSel?.precio ?? 0)
            : undefined,
        propina: payload.prop > 0 ? payload.prop : undefined,
      }),
    onSuccess: (citaActualizada) => {
      qc.invalidateQueries({ queryKey: ["citas-pagos"] });
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaSel(null);
      setMetodoPago("");
      setMontoRecibido("");
      setPropina("");
      setCitaPagada(citaActualizada);
    },
  });

  const mutRevertir = useMutation({
    mutationFn: (id: string) => pagosApi.registrar(id, { pagada: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["citas-pagos"] });
      qc.invalidateQueries({ queryKey: ["historial-pagos"] });
      qc.invalidateQueries({ queryKey: ["citas"] });
      toast("Pago revertido");
    },
    onError: () => toast("No se pudo revertir el pago", "error"),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const cambio =
    metodoPago === "Efectivo" && montoRecibido && citaSel
      ? parseFloat(montoRecibido) - citaSel.precio
      : null;

  const puedeConfirmar =
    metodoPago !== "" &&
    (metodoPago !== "Efectivo" ||
      parseFloat(montoRecibido || "0") >= (citaSel?.precio ?? 0));

  const handleConfirmar = () => {
    if (!citaSel) return;
    mutPagar.mutate({
      id: citaSel.id,
      montoRec: parseFloat(montoRecibido || "0"),
      prop: parseFloat(propina || "0"),
    });
  };

  const handleEnviarEmail = async () => {
    if (!citaPagada) return;
    setEnviandoEmail(true);
    try {
      await pagosApi.enviarTicketEmail(citaPagada.id);
      toast("Ticket enviado al correo del cliente");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      toast(msg ?? "El cliente no tiene correo registrado", "error");
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleExportarHistorial = () => {
    if (histFiltrado.length === 0) { toast("No hay pagos en el período seleccionado", "error"); return; }
    exportarExcel(
      ["Fecha pago", "Cliente", "Servicio", "Empleado", "Método", "Total", "Propina"],
      histFiltrado.map(c => [[
        c.fechaPago ? new Date(c.fechaPago).toLocaleDateString("es-MX") : "",
        c.nombreCliente,
        c.nombreServicio,
        c.nombreEmpleado ?? "",
        c.metodoPago ?? "",
        (c.montoCobrado ?? c.precio),
        c.propina ?? 0,
      ]]),
      `historial-pagos-${histDesde}-${histHasta}`,
      `Historial de pagos`,
      {
        subtitulo: `Del ${histDesde} al ${histHasta}`,
        totales: ["", "", "", "", "Total:", histTotalCobrado, histTotalPropinas],
      }
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pagos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {esEmpleado ? "Tus citas del período seleccionado" : "Gestión y registro de cobros"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1 gap-1">
        {([["cobro", "Cobro"], ["historial", "Historial"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition whitespace-nowrap ${
              tab === key
                ? "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB COBRO ─────────────────────────────────────────────────────── */}
      {tab === "cobro" && (
        <>
          {/* KPI cards */}
          {!cobroLoading && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <TrendingUp size={14} /> Total cobrado
                </div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${totalCobrado.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <AlertCircle size={14} /> Por cobrar
                </div>
                <p className="text-xl font-bold text-amber-500 dark:text-amber-400">${totalPendiente.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <CheckCircle2 size={14} /> Citas pagadas
                </div>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200">
                  {citasPagadas}<span className="text-sm font-medium text-gray-400 dark:text-gray-500"> / {totalCitas}</span>
                </p>
              </div>
            </div>
          )}

          {/* Desglose por método */}
          {!cobroLoading && citasPagadas > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Desglose por método</p>
              <div className="flex flex-wrap gap-4">
                {METODOS_PAGO.map(m => (
                  desglose[m] > 0 && (
                    <div key={m} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 dark:text-gray-500">{METODO_ICONO[m]}</span>
                      <span className="text-gray-600 dark:text-gray-400">{m}</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">${desglose[m].toFixed(2)}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Período</p>
              <div className="flex gap-1">
                {PERIODOS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriodo(p.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                      periodo === p.key
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Estado</p>
              <div className="flex gap-1">
                {(["pendientes", "todas", "pagadas"] as FiltroEstadoPago[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltroPago(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition ${
                      filtroPago === f
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-slate-400"
                    }`}
                  >
                    {f === "pendientes" ? "Pendientes" : f === "pagadas" ? "Pagadas" : "Todas"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Buscar cliente</p>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Nombre del cliente..."
                  value={busquedaCobro}
                  onChange={e => setBusquedaCobro(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
              </div>
            </div>
          </div>

          {/* Cards */}
          {cobroLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-36 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : citasFiltradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">
                {busquedaCobro.trim()
                  ? "No hay citas para ese cliente"
                  : filtroPago === "pendientes"
                  ? "No hay citas pendientes de pago en este período"
                  : "No hay citas en este período"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {citasFiltradas.map((cita) => (
                <CitaCard
                  key={cita.id}
                  cita={cita}
                  onCobrar={() => { setCitaSel(cita); setMetodoPago(""); setMontoRecibido(""); setPropina(""); }}
                  onRevertir={() => mutRevertir.mutate(cita.id)}
                  revertiendoId={mutRevertir.isPending && mutRevertir.variables === cita.id ? cita.id : null}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB HISTORIAL ─────────────────────────────────────────────────── */}
      {tab === "historial" && (
        <>
          {/* Filtros historial */}
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Fecha pago desde</p>
              <input
                type="date"
                value={histDesde}
                onChange={e => setHistDesde(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-700/30"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Hasta</p>
              <input
                type="date"
                value={histHasta}
                onChange={e => setHistHasta(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-700/30"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Buscar cliente</p>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Nombre del cliente..."
                  value={busquedaHist}
                  onChange={e => setBusquedaHist(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
              </div>
            </div>
            <button
              onClick={handleExportarHistorial}
              className="flex items-center gap-2 px-3 py-2 text-xs border border-gray-200 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 transition"
            >
              <Download size={14} /> Exportar Excel
            </button>
          </div>

          {/* KPIs historial */}
          {!histLoading && histFiltrado.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <TrendingUp size={14} /> Total cobrado
                </div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">${histTotalCobrado.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Receipt size={14} /> Propinas
                </div>
                <p className="text-xl font-bold text-teal-600 dark:text-teal-400">${histTotalPropinas.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <CheckCircle2 size={14} /> Pagos
                </div>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{histFiltrado.length}</p>
              </div>
            </div>
          )}

          {/* Desglose historial */}
          {!histLoading && histFiltrado.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Desglose por método</p>
              <div className="flex flex-wrap gap-4">
                {METODOS_PAGO.map(m => (
                  histDesglose[m] > 0 && (
                    <div key={m} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400 dark:text-gray-500">{METODO_ICONO[m]}</span>
                      <span className="text-gray-600 dark:text-gray-400">{m}</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">${histDesglose[m].toFixed(2)}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Tabla historial */}
          {histLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : histFiltrado.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <Receipt size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay pagos registrados en este período</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha pago</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Servicio</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Empleado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Método</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Propina</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {histFiltrado.map((c) => (
                      <HistorialRow
                        key={c.id}
                        cita={c}
                        onRevertir={() => mutRevertir.mutate(c.id)}
                        revertiendoId={mutRevertir.isPending && mutRevertir.variables === c.id ? c.id : null}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 font-semibold">
                      <td colSpan={5} className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">${histTotalCobrado.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-teal-600 dark:text-teal-400 hidden sm:table-cell">${histTotalPropinas.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: registrar pago */}
      <Modal
        abierto={!!citaSel}
        onCerrar={() => { setCitaSel(null); setMetodoPago(""); setMontoRecibido(""); setPropina(""); }}
        titulo="Registrar pago"
        ancho="sm"
      >
        {citaSel && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-1 text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{citaSel.nombreCliente}</p>
              <p className="text-gray-500 dark:text-gray-400">{citaSel.nombreServicio}</p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-2">${citaSel.precio.toFixed(2)}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {METODOS_PAGO.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMetodoPago(m); setMontoRecibido(""); }}
                    className={`py-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-1 transition ${
                      metodoPago === m
                        ? "bg-slate-700 text-white border-slate-700"
                        : "border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:border-slate-400"
                    }`}
                  >
                    {METODO_ICONO_LG[m]}
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {metodoPago === "Efectivo" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Monto recibido</label>
                <input
                  type="number"
                  step="0.01"
                  min={citaSel.precio}
                  placeholder="Monto recibido"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  className="mt-1 w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
                {cambio !== null && cambio >= 0 && (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    Cambio: <span className="font-bold">${cambio.toFixed(2)}</span>
                  </p>
                )}
                {cambio !== null && cambio < 0 && (
                  <p className="mt-2 text-sm text-red-500">El monto recibido es menor al total</p>
                )}
              </div>
            )}

            {metodoPago !== "" && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Propina (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={propina}
                  onChange={(e) => setPropina(e.target.value)}
                  className="mt-1 w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
              </div>
            )}

            <button
              onClick={handleConfirmar}
              disabled={!puedeConfirmar || mutPagar.isPending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl transition text-sm"
            >
              {mutPagar.isPending ? "Procesando…" : "Confirmar pago"}
            </button>
          </div>
        )}
      </Modal>

      {/* Modal: ticket de recibo */}
      <Modal
        abierto={!!citaPagada}
        onCerrar={() => setCitaPagada(null)}
        titulo="Pago registrado"
        ancho="sm"
      >
        {citaPagada && (
          <TicketRecibo
            cita={citaPagada}
            negocioNombre={negocio?.nombre ?? ""}
            negocioLogo={negocio?.logoUrl}
            onClose={() => setCitaPagada(null)}
            onEnviarEmail={handleEnviarEmail}
            enviandoEmail={enviandoEmail}
          />
        )}
      </Modal>
    </div>
  );
}

/* ── CitaCard ──────────────────────────────────────────────────────────── */
function CitaCard({
  cita, onCobrar, onRevertir, revertiendoId,
}: {
  cita: CitaDto;
  onCobrar: () => void;
  onRevertir: () => void;
  revertiendoId: string | null;
}) {
  const hora = cita.inicioEn
    ? new Date(cita.inicioEn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div
      className={`bg-white dark:bg-slate-800 border rounded-xl p-4 space-y-3 shadow-sm ${
        cita.pagada
          ? "border-emerald-100 dark:border-emerald-900/40"
          : "border-gray-200 dark:border-slate-600"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{cita.nombreCliente}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{cita.nombreServicio}</p>
        </div>
        {cita.pagada ? (
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <Circle size={18} className="text-gray-300 dark:text-slate-600 shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><Clock size={12} /> {hora}</span>
        {cita.nombreEmpleado && <span className="truncate">{cita.nombreEmpleado}</span>}
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">${cita.precio.toFixed(2)}</span>
        {cita.pagada ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
              {cita.metodoPago ?? "Pagada"}
            </span>
            <button
              onClick={onRevertir}
              disabled={revertiendoId === cita.id}
              title="Revertir pago"
              className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40 transition rounded"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={onCobrar}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition"
          >
            Cobrar
          </button>
        )}
      </div>
    </div>
  );
}

/* ── HistorialRow ──────────────────────────────────────────────────────── */
function HistorialRow({
  cita, onRevertir, revertiendoId,
}: {
  cita: CitaDto;
  onRevertir: () => void;
  revertiendoId: string | null;
}) {
  const fechaPago = cita.fechaPago
    ? new Date(cita.fechaPago).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition">
      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fechaPago}</td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{cita.nombreCliente}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">{cita.nombreServicio}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">{cita.nombreEmpleado ?? "—"}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
          {METODO_ICONO[cita.metodoPago ?? ""] ?? null}
          {cita.metodoPago ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap">
        ${(cita.montoCobrado ?? cita.precio).toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right text-sm text-teal-600 dark:text-teal-400 hidden sm:table-cell">
        {cita.propina && cita.propina > 0 ? `$${cita.propina.toFixed(2)}` : "—"}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onRevertir}
          disabled={revertiendoId === cita.id}
          title="Revertir pago"
          className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40 transition rounded"
        >
          <RotateCcw size={13} />
        </button>
      </td>
    </tr>
  );
}
