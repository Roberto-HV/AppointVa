import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Clock, CheckCircle2, Circle, Banknote, Building2,
  RotateCcw, Download, Search, TrendingUp, AlertCircle, Receipt, Printer, Users, X,
} from "lucide-react";
import { citasApi, METODOS_PAGO } from "../../api/citas";
import { pagosApi } from "../../api/pagos";
import { negociosApi } from "../../api/negocios";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { exportarExcel } from "../../utils/exportarExcel";
import Modal from "../../components/ui/Modal";
import { DatePicker } from "../../components/ui/DateTimePicker";
import TicketRecibo from "../../components/dashboard/TicketRecibo";
import { cierreCajaApi } from "../../api/cierreCaja";
import type { CitaDto, CierreCajaDto, GuardarCierreCajaDto, RetiroItem } from "../../types";

type FiltroEstadoPago = "todas" | "pendientes" | "pagadas";
type FiltroPeriodo = "hoy" | "semana" | "mes";
type Tab = "cobro" | "historial" | "corte";

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

function montoParaMetodo(cita: CitaDto, metodo: string): number {
  const total = cita.montoCobrado ?? cita.precio ?? 0;
  const m2 = cita.montoPago2 ?? 0;
  const m1 = total - m2;
  let result = 0;
  if ((cita.metodoPago?.toLowerCase() ?? '') === metodo.toLowerCase()) result += m1;
  if ((cita.metodoPago2?.toLowerCase() ?? '') === metodo.toLowerCase()) result += m2;
  return result;
}

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
  const [isSplit,       setIsSplit]       = useState(false);
  const [metodoPago2,   setMetodoPago2]   = useState<string>('Tarjeta');
  const [montoPago2Input, setMontoPago2Input] = useState<string>('');
  const [montoCobradoInput, setMontoCobradoInput] = useState<string>('');
  const [citaPagada,    setCitaPagada]    = useState<CitaDto | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // ── Historial tab state ───────────────────────────────────────────────────
  const [histDesde,     setHistDesde]     = useState(inicioMes);
  const [histHasta,     setHistHasta]     = useState(hoy);
  const [busquedaHist,  setBusquedaHist]  = useState("");

  // ── Corte tab state ───────────────────────────────────────────────────────
  const [corteDate, setCorteDate] = useState(hoy);

  // ── Cierre de caja state ──────────────────────────────────────────────────
  const [cierreInicio,    setCierreInicio]    = useState<string>('');
  const [cierreContado,   setCierreContado]   = useState<string>('');
  const [retiros,         setRetiros]         = useState<RetiroItem[]>([]);
  const [retiroConcepto,  setRetiroConcepto]  = useState('');
  const [retiroMonto,     setRetiroMonto]     = useState('');

  // ── Sync metodoPago2 when metodoPago changes ───────────────────────────────
  useEffect(() => {
    const primera = METODOS_PAGO.find(m => m !== metodoPago) ?? 'Tarjeta';
    setMetodoPago2(primera);
  }, [metodoPago]);

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
    staleTime: 0,
    // Solo sigue el polling mientras el usuario está en el tab de cobro
    refetchInterval: tab === "cobro" ? 30_000 : false,
  });

  const { data: historialData = [], isLoading: histLoading } = useQuery({
    queryKey: ["historial-pagos", histDesde, histHasta],
    queryFn: () => citasApi.obtenerHistorialPagos({ desde: histDesde, hasta: histHasta }),
    // Se carga al entrar al tab; no necesita polling — es data histórica
    enabled: tab === "historial",
    staleTime: 2 * 60 * 1000,
  });

  const { data: corteData = [], isLoading: corteLoading } = useQuery({
    queryKey: ["historial-pagos-corte", corteDate],
    queryFn: () => citasApi.obtenerHistorialPagos({ desde: corteDate, hasta: corteDate }),
    // Se carga al entrar al tab o cambiar fecha; el corte es un reporte, no necesita polling
    enabled: tab === "corte",
    staleTime: 2 * 60 * 1000,
  });

  const { data: cierreData } = useQuery<CierreCajaDto>({
    queryKey: ['cierre-caja', corteDate],
    queryFn: () => cierreCajaApi.obtener(corteDate),
    enabled: tab === 'corte',
  });

  // Reset fields when date changes (must run before populate to avoid stale data)
  useEffect(() => {
    setCierreInicio('');
    setCierreContado('');
    setRetiros([]);
  }, [corteDate]);

  // Pre-populate from existing cierre when data loads
  useEffect(() => {
    if (cierreData) {
      setCierreInicio(cierreData.efectivoInicial > 0 ? cierreData.efectivoInicial.toFixed(2) : '');
      setCierreContado(cierreData.efectivoContado > 0 ? cierreData.efectivoContado.toFixed(2) : '');
      setRetiros(cierreData.retiros ?? []);
    }
  }, [cierreData]);

  // ── Cobro derived data ────────────────────────────────────────────────────
  const todas = pagina?.datos ?? [];

  const totalCobrado   = todas.filter(c => c.pagada).reduce((s, c) => s + (c.montoCobrado ?? c.precio), 0);
  const totalPendiente = todas.filter(c => !c.pagada).reduce((s, c) => s + c.precio, 0);
  const citasPagadas   = todas.filter(c => c.pagada).length;
  const totalCitas     = todas.length;

  const desglose = METODOS_PAGO.reduce<Record<string, number>>((acc, m) => {
    acc[m] = todas.filter(c => c.pagada)
      .reduce((s, c) => s + montoParaMetodo(c, m), 0);
    return acc;
  }, {});

  const cobroDesglose = METODOS_PAGO
    .map(m => ({
      metodo: m,
      cantidad: todas.filter(c => c.pagada && c.metodoPago === m).length,
      monto: desglose[m] ?? 0,
    }))
    .filter(d => d.monto > 0);

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
    acc[m] = histFiltrado.reduce((s, c) => s + montoParaMetodo(c, m), 0);
    return acc;
  }, {});

  const histDesgloseArr = METODOS_PAGO
    .map(m => ({
      metodo: m,
      cantidad: histFiltrado.filter(c => montoParaMetodo(c, m) > 0).length,
      monto: histDesglose[m] ?? 0,
    }))
    .filter(d => d.cantidad > 0);

  const histPromedio = histFiltrado.length > 0 ? histTotalCobrado / histFiltrado.length : 0;

  // ── Corte derived data ────────────────────────────────────────────────────
  const corteTotalCobrado  = corteData.reduce((s, c) => s + (c.montoCobrado ?? c.precio), 0);
  const corteTotalPropinas = corteData.reduce((s, c) => s + (c.propina ?? 0), 0);

  const corteDesglose = METODOS_PAGO
    .map(m => ({
      metodo: m,
      cantidad: corteData.filter(c => montoParaMetodo(c, m) > 0).length,
      monto: corteData.reduce((s, c) => s + montoParaMetodo(c, m), 0),
    }))
    .filter(d => d.cantidad > 0);

  const cortePorEmpleado = Object.values(
    corteData.reduce<Record<string, { nombre: string; cantidad: number; monto: number; propinas: number }>>((acc, c) => {
      const k = c.nombreEmpleado;
      if (!acc[k]) acc[k] = { nombre: k, cantidad: 0, monto: 0, propinas: 0 };
      acc[k].cantidad++;
      acc[k].monto    += c.montoCobrado ?? c.precio;
      acc[k].propinas += c.propina ?? 0;
      return acc;
    }, {})
  ).sort((a, b) => b.monto - a.monto);

  const cortePromedio = corteData.length > 0 ? corteTotalCobrado / corteData.length : 0;

  // ── Cierre computed values ────────────────────────────────────────────────
  const efectivoCobradoDia = cierreData?.efectivoCobrado ?? 0;
  const inicioDec          = parseFloat(cierreInicio) || 0;
  const contadoDec         = parseFloat(cierreContado) || 0;
  const totalRetirosDec    = retiros.reduce((s, r) => s + r.monto, 0);
  const efectivoEsperado   = inicioDec + efectivoCobradoDia - totalRetirosDec;
  const diferencia         = contadoDec - efectivoEsperado;
  const cuadrado           = Math.abs(diferencia) < 0.01;

  const handleImprimirCorte = () => {
    const fechaLegible = new Date(corteDate + "T12:00:00").toLocaleDateString("es-MX", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const filaMetodos = corteDesglose
      .map(d => `<tr><td style="padding:3px 8px 3px 0">${d.metodo}</td><td style="text-align:right">${d.cantidad} cita${d.cantidad !== 1 ? "s" : ""}</td><td style="text-align:right;font-weight:600">$${d.monto.toFixed(2)}</td></tr>`)
      .join("");
    const filaEmpleados = cortePorEmpleado
      .map(e => `<tr><td style="padding:3px 8px 3px 0">${e.nombre}</td><td style="text-align:right">${e.cantidad} cita${e.cantidad !== 1 ? "s" : ""}</td><td style="text-align:right;font-weight:600">$${e.monto.toFixed(2)}</td></tr>`)
      .join("");

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .section { border-top: 1px dashed #d1d5db; margin-top: 10px; padding-top: 10px; }
        .label { color: #6b7280; font-size: 10px; }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-weight:700;font-size:14px">${negocio?.nombre ?? "Negocio"}</div>
        <div style="color:#6b7280;font-size:10px;margin-top:2px">CORTE DE CAJA</div>
        <div style="font-size:10px;margin-top:2px;text-transform:capitalize">${fechaLegible}</div>
      </div>
      <div class="section">
        <table>
          <tr><td>Citas atendidas</td><td style="text-align:right;font-weight:700">${corteData.length}</td></tr>
          <tr><td>Total cobrado</td><td style="text-align:right;font-weight:700">$${corteTotalCobrado.toFixed(2)}</td></tr>
          ${corteTotalPropinas > 0 ? `<tr><td>Propinas</td><td style="text-align:right">$${corteTotalPropinas.toFixed(2)}</td></tr>` : ""}
        </table>
      </div>
      ${corteDesglose.length > 0 ? `
      <div class="section">
        <div style="font-weight:700;margin-bottom:6px;font-size:10px;letter-spacing:.05em">DESGLOSE POR MÉTODO</div>
        <table>${filaMetodos}</table>
      </div>` : ""}
      ${cortePorEmpleado.length > 0 ? `
      <div class="section">
        <div style="font-weight:700;margin-bottom:6px;font-size:10px;letter-spacing:.05em">POR EMPLEADO</div>
        <table>${filaEmpleados}</table>
      </div>` : ""}
      <div style="text-align:center;font-size:10px;color:#9ca3af;border-top:1px dashed #d1d5db;margin-top:10px;padding-top:8px">AppointVa</div>
    </body></html>`;

    const w = window.open("", "_blank", "width=340,height=600");
    if (!w) {
      toast("El navegador bloqueó la ventana de impresión. Permite popups para este sitio.", "error");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  // ── Payment helpers ───────────────────────────────────────────────────────
  const montoCobradoDec = montoCobradoInput !== ''
    ? (parseFloat(montoCobradoInput) || 0)
    : (citaSel?.precio ?? 0);
  const montoRecibidoDec = parseFloat(montoRecibido || "0");
  const montoPago2Dec = parseFloat(montoPago2Input) || 0;
  const montoPago1Dec = isSplit ? Math.max(0, montoCobradoDec - montoPago2Dec) : montoCobradoDec;

  const hayEfectivo =
    metodoPago === 'Efectivo' ||
    (isSplit && metodoPago2 === 'Efectivo');

  const porcionEfectivo = (() => {
    if (!hayEfectivo) return 0;
    if (!isSplit) return montoCobradoDec;
    if (metodoPago === 'Efectivo') return montoPago1Dec;
    return montoPago2Dec;
  })();

  const cambio = hayEfectivo
    ? Math.max(0, montoRecibidoDec - porcionEfectivo)
    : 0;

  const puedeConfirmar =
    citaSel !== null &&
    metodoPago !== "" &&
    montoCobradoDec > 0 &&
    (!isSplit || (montoPago2Dec > 0 && montoPago2Dec < montoCobradoDec)) &&
    (!hayEfectivo || montoRecibidoDec >= porcionEfectivo);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const mutPagar = useMutation({
    mutationFn: (payload: { id: string; montoRec: number; prop: number }) =>
      pagosApi.registrar(payload.id, {
        pagada: true,
        metodoPago,
        montoCobrado: montoCobradoDec,
        montoRecibido: hayEfectivo ? payload.montoRec : undefined,
        cambio: hayEfectivo && cambio > 0 ? cambio : undefined,
        propina: payload.prop > 0 ? payload.prop : undefined,
        ...(isSplit && {
          metodoPago2,
          montoPago2: montoPago2Dec,
        }),
      }),
    onSuccess: (citaActualizada) => {
      qc.invalidateQueries({ queryKey: ["citas-pagos"] });
      qc.invalidateQueries({ queryKey: ["citas"] });
      setCitaSel(null);
      setMetodoPago("");
      setMontoRecibido("");
      setPropina("");
      setIsSplit(false);
      setMetodoPago2('Tarjeta');
      setMontoPago2Input('');
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

  const mutCierre = useMutation({
    mutationFn: (payload: GuardarCierreCajaDto) => cierreCajaApi.guardar(payload),
    onSuccess: (data) => {
      setCierreInicio(data.efectivoInicial.toFixed(2));
      setCierreContado(data.efectivoContado.toFixed(2));
      setRetiros(data.retiros);
      qc.invalidateQueries({ queryKey: ['cierre-caja', corteDate] });
    },
  });

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
    <div className="p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pagos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {esEmpleado ? "Tus citas del período seleccionado" : "Gestión y registro de cobros"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1 gap-1">
        {([["cobro", "Cobro"], ["historial", "Historial"], ["corte", "Corte del día"]] as [Tab, string][]).map(([key, label]) => (
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

          {/* Payment progress + desglose */}
          {!cobroLoading && totalCitas > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${totalCitas > 0 ? Math.round((citasPagadas / totalCitas) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 font-medium">
                  {citasPagadas}/{totalCitas} cobradas
                </span>
              </div>
            </div>
          )}

          {!cobroLoading && cobroDesglose.length > 0 && (
            <DesglosePorMetodo titulo="Desglose por método" data={cobroDesglose} total={totalCobrado} />
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
                  onCobrar={() => {
                    setCitaSel(cita);
                    setMetodoPago("");
                    setMontoRecibido("");
                    setPropina("");
                    setIsSplit(false);
                    setMetodoPago2('Tarjeta');
                    setMontoPago2Input('');
                    if (cita.anticipoRecibido && cita.montoAnticipo) {
                      setMontoCobradoInput(
                        String(Math.max(0, cita.precio - cita.montoAnticipo))
                      );
                    } else {
                      setMontoCobradoInput('');
                    }
                  }}
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
            <div className="w-full sm:w-48">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Fecha pago desde</p>
              <DatePicker value={histDesde} onChange={v => setHistDesde(v)} />
            </div>
            <div className="w-full sm:w-48">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Hasta</p>
              <DatePicker value={histHasta} onChange={v => setHistHasta(v)} />
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <TrendingUp size={14} /> Total cobrado
                </div>
                <p className="text-xl font-bold text-white">${histTotalCobrado.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <CheckCircle2 size={14} /> Pagos
                </div>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{histFiltrado.length}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <Receipt size={14} /> Propinas
                </div>
                <p className="text-xl font-bold text-teal-600 dark:text-teal-400">${histTotalPropinas.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <CreditCard size={14} /> Promedio/cita
                </div>
                <p className="text-xl font-bold text-slate-700 dark:text-slate-200">${histPromedio.toFixed(2)}</p>
              </div>
            </div>
          )}

          {!histLoading && histDesgloseArr.length > 0 && (
            <DesglosePorMetodo titulo="Desglose por método" data={histDesgloseArr} total={histTotalCobrado} />
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

      {/* ── TAB CORTE DEL DÍA ─────────────────────────────────────────────── */}
      {tab === "corte" && (
        <div className="space-y-5">
          {/* Selector de fecha + botón imprimir */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha del corte</label>
              <div className="w-full sm:w-48">
                <DatePicker value={corteDate} onChange={v => setCorteDate(v)} />
              </div>
            </div>
            <button
              onClick={handleImprimirCorte}
              disabled={corteData.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg transition"
            >
              <Printer size={15} /> Imprimir corte
            </button>
          </div>

          {corteLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />)}
            </div>
          ) : corteData.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <Receipt size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Sin cobros registrados para esta fecha</p>
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><CheckCircle2 size={13} /> Citas atendidas</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-gray-100">{corteData.length}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><TrendingUp size={13} /> Total cobrado</p>
                  <p className="text-2xl font-black text-white">${corteTotalCobrado.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><CreditCard size={13} /> Propinas</p>
                  <p className="text-2xl font-black text-teal-600 dark:text-teal-400">${corteTotalPropinas.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5"><Receipt size={13} /> Promedio/cita</p>
                  <p className="text-2xl font-black text-slate-700 dark:text-slate-200">${cortePromedio.toFixed(2)}</p>
                </div>
              </div>

              <DesglosePorMetodo titulo="Desglose por método de pago" data={corteDesglose} total={corteTotalCobrado} />

              {/* Por empleado */}
              {cortePorEmpleado.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <Users size={15} /> Ingresos por empleado
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-700">
                          <th className="pb-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Empleado</th>
                          <th className="pb-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Citas</th>
                          <th className="pb-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Propinas</th>
                          <th className="pb-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                        {cortePorEmpleado.map(e => (
                          <tr key={e.nombre}>
                            <td className="py-3 font-medium text-gray-800 dark:text-gray-200">{e.nombre}</td>
                            <td className="py-3 text-right text-gray-500 dark:text-gray-400">{e.cantidad}</td>
                            <td className="py-3 text-right text-teal-600 dark:text-teal-400">${e.propinas.toFixed(2)}</td>
                            <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">${e.monto.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-slate-600 font-semibold">
                          <td className="pt-3 text-xs text-gray-500 uppercase tracking-wider">Total</td>
                          <td className="pt-3 text-right text-gray-500">{corteData.length}</td>
                          <td className="pt-3 text-right text-teal-600 dark:text-teal-400">${corteTotalPropinas.toFixed(2)}</td>
                          <td className="pt-3 text-right text-emerald-600 dark:text-emerald-400">${corteTotalCobrado.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Cierre formal de caja */}
          <div className="mt-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Cierre formal de caja
            </h3>

            {/* 3-column grid: inicio / cobrado / contado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Efectivo inicial</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cierreInicio}
                  onChange={e => setCierreInicio(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cobrado en efectivo</label>
                <input
                  readOnly
                  value={efectivoCobradoDia.toFixed(2)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-600 dark:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Efectivo contado</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cierreContado}
                  onChange={e => setCierreContado(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Retiros */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Retiros de caja</p>
              {retiros.map((r, i) => (
                <div key={i} className="flex items-center gap-2 mb-1">
                  <span className="flex-1 text-sm">{r.concepto}</span>
                  <span className="text-sm font-mono">${r.monto.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => setRetiros(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 mt-2">
                <input
                  type="text"
                  value={retiroConcepto}
                  onChange={e => setRetiroConcepto(e.target.value)}
                  placeholder="Concepto"
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={retiroMonto}
                  onChange={e => setRetiroMonto(e.target.value)}
                  placeholder="Monto"
                  className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const monto = parseFloat(retiroMonto);
                    if (retiroConcepto.trim() && monto > 0) {
                      setRetiros(prev => [...prev, { concepto: retiroConcepto.trim(), monto }]);
                      setRetiroConcepto('');
                      setRetiroMonto('');
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {/* Formula summary */}
            <div className={`rounded-xl p-4 border ${
              cuadrado
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
            }`}>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Inicio + Cobrado − Retiros</span>
                  <span className="font-mono">${efectivoEsperado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Contado</span>
                  <span className="font-mono">${contadoDec.toFixed(2)}</span>
                </div>
                <div className={`flex justify-between font-semibold border-t pt-1 mt-1 ${
                  cuadrado ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
                }`}>
                  <span>Diferencia</span>
                  <span className="font-mono">{diferencia >= 0 ? '+' : ''}{diferencia.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={mutCierre.isPending}
              onClick={() => mutCierre.mutate({
                fecha: corteDate,
                efectivoInicial: inicioDec,
                efectivoContado: contadoDec,
                retiros,
              })}
              className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {mutCierre.isPending ? 'Guardando...' : 'Guardar cierre'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: registrar pago */}
      <Modal
        abierto={!!citaSel}
        onCerrar={() => { setCitaSel(null); setMetodoPago(""); setMontoRecibido(""); setPropina(""); setIsSplit(false); setMetodoPago2('Tarjeta'); setMontoPago2Input(''); setMontoCobradoInput(''); }}
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

            {citaSel?.anticipoRecibido && citaSel.montoAnticipo && (
              <div className="flex items-start gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="text-sm text-emerald-800 dark:text-emerald-300">
                  <span className="font-semibold">Anticipo registrado: ${citaSel.montoAnticipo.toFixed(2)}</span>
                  <br />
                  <span className="text-xs">Total a cobrar ajustado automáticamente. Puedes modificarlo abajo.</span>
                </div>
              </div>
            )}

            {citaSel?.anticipoRecibido && citaSel.montoAnticipo && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Total a cobrar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={montoCobradoInput}
                    onChange={e => setMontoCobradoInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Precio original: ${citaSel.precio.toFixed(2)} — Anticipo: −${citaSel.montoAnticipo.toFixed(2)}
                </p>
              </div>
            )}

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

            {/* Split-payment toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Dividir pago</span>
              <button
                type="button"
                onClick={() => { setIsSplit(v => !v); setMontoPago2Input(''); }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isSplit ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSplit ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {isSplit && (
              <div className="space-y-3 border-t border-dashed border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Monto en {metodoPago}</label>
                    <input
                      readOnly
                      value={montoPago1Dec.toFixed(2)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Segundo método</label>
                    <select
                      value={metodoPago2}
                      onChange={e => setMetodoPago2(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      {['Efectivo','Tarjeta','Transferencia'].filter(m => m !== metodoPago).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monto en {metodoPago2}</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={montoPago2Input}
                    onChange={e => setMontoPago2Input(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {hayEfectivo && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Monto recibido</label>
                <input
                  type="number"
                  step="0.01"
                  min={porcionEfectivo}
                  placeholder="Monto recibido"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  className="mt-1 w-full border border-gray-200 dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/30"
                />
                {montoRecibido && cambio > 0 && (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    Cambio: <span className="font-bold">${cambio.toFixed(2)}</span>
                  </p>
                )}
                {montoRecibido && montoRecibidoDec < porcionEfectivo && (
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

/* ── DesglosePorMetodo ─────────────────────────────────────────────────── */
function DesglosePorMetodo({
  titulo, data, total,
}: {
  titulo: string;
  data: { metodo: string; monto: number; cantidad: number }[];
  total: number;
}) {
  if (data.length === 0) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-4">{titulo}</h3>
      <div className="space-y-3">
        {data.map(d => {
          const pct = total > 0 ? Math.round((d.monto / total) * 100) : 0;
          return (
            <div key={d.metodo} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                {METODO_ICONO_LG[d.metodo] ?? <CreditCard size={20} strokeWidth={1.5} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{d.metodo}</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">${d.monto.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-slate-700 dark:bg-slate-400 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                    {d.cantidad} cita{d.cantidad !== 1 ? "s" : ""} · {pct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
    ? new Date(cita.inicioEn).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true })
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
              {cita.metodoPago ?? "Pagada"}{cita.metodoPago2 ? ` + ${cita.metodoPago2}` : ''}
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
          {cita.metodoPago ?? "—"}{cita.metodoPago2 ? ` + ${cita.metodoPago2}` : ''}
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
