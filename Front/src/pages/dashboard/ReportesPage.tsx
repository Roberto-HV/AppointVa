import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Download, TrendingUp, Calendar, DollarSign, CheckCircle } from "lucide-react";
import { reportesApi, type FiltrosReporteCitas } from "../../api/reportes";
import { Users, RefreshCw } from "lucide-react";
import { exportarExcel } from "../../utils/exportarExcel";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { formatPrecio, formatFechaHora as formatFecha } from "../../utils/formatters";

type Tab = "citas" | "ingresos" | "empleados" | "heatmap" | "retencion";

const ESTADOS_OPCIONES = [
  { valor: 1, texto: "Pendiente" },
  { valor: 2, texto: "Confirmada" },
  { valor: 3, texto: "Completada" },
  { valor: 4, texto: "Cancelada" },
  { valor: 5, texto: "Inasistencia" },
];

const COLORES_GRAFICA = ["#C8A961", "#a88b45", "#e8d4a0", "#7a6530", "#d4bc80"];

function hoy() {
  return new Date().toISOString().split("T")[0];
}

function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

function inicioSemana() {
  const d = new Date();
  const dia = d.getDay();
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return lunes.toISOString().split("T")[0];
}

function inicioAnio() {
  return `${new Date().getFullYear()}-01-01`;
}

interface TarjetaProps { label: string; valor: string; subvalor?: string; icono: React.ReactNode }
function Tarjeta({ label, valor, subvalor, icono }: TarjetaProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5 flex items-center gap-3">
      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-700/10 rounded-lg flex items-center justify-center text-slate-700 shrink-0">
        {icono}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-base sm:text-xl font-bold text-gray-900 truncate">{valor}</p>
        {subvalor && <p className="text-xs text-gray-400">{subvalor}</p>}
      </div>
    </div>
  );
}

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>("citas");
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [empleadoId, setEmpleadoId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [estado, setEstado] = useState("");

  const filtros: FiltrosReporteCitas = {
    desde,
    hasta,
    empleadoId: empleadoId || undefined,
    servicioId: servicioId || undefined,
    estado: estado ? Number(estado) : undefined,
  };

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados-reporte"],
    queryFn: () => empleadosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: servicios = [] } = useQuery({
    queryKey: ["servicios-reporte"],
    queryFn: serviciosApi.obtenerTodos,
    staleTime: 1000 * 60 * 5,
  });

  const { data: reporteCitas, isLoading: cargandoCitas, isError: errorCitas } = useQuery({
    queryKey: ["reporte-citas", filtros],
    queryFn: () => reportesApi.obtenerCitas(filtros),
    enabled: tab === "citas",
  });

  const { data: reporteIngresos, isLoading: cargandoIngresos, isError: errorIngresos } = useQuery({
    queryKey: ["reporte-ingresos", desde, hasta],
    queryFn: () => reportesApi.obtenerIngresos(desde, hasta),
    enabled: tab === "ingresos" || tab === "empleados",
  });

  const { data: heatmap, isLoading: cargandoHeatmap } = useQuery({
    queryKey: ["reporte-heatmap", desde, hasta],
    queryFn: () => reportesApi.obtenerHeatmap(desde, hasta),
    enabled: tab === "heatmap",
  });

  const { data: retencion, isLoading: cargandoRetencion } = useQuery({
    queryKey: ["reporte-retencion", desde, hasta],
    queryFn: () => reportesApi.obtenerRetencion(desde, hasta),
    enabled: tab === "retencion",
  });

  const handleExportar = () => {
    if (!reporteCitas?.citas.length) return;

    const fmtFecha = (iso: string) =>
      new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const subtitulo = `Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}`;

    const encabezados = ["Código", "Cliente", "Teléfono", "Email", "Servicio", "Empleado", "Fecha", "Duración (min)", "Precio", "Pagada", "Método de pago", "Estado", "Notas"];
    const filas = reporteCitas.citas.map((c) => [
      c.codigoConfirmacion,
      c.nombreCliente,
      c.telefonoCliente ?? "",
      c.emailCliente ?? "",
      c.nombreServicio,
      c.nombreEmpleado,
      new Date(c.inicioEn).toLocaleString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }),
      c.duracionMinutos,
      `$${c.precio.toFixed(2)}`,
      c.pagada ? "Sí" : "No",
      c.metodoPago ?? "",
      c.estadoTexto,
      c.notas ?? "",
    ]);

    const totalMinutos = reporteCitas.citas.reduce((s, c) => s + c.duracionMinutos, 0);
    const totales: (string | number)[] = [
      `${reporteCitas.totalCitas} citas`,
      "", "", "", "", "", "",
      totalMinutos,
      `$${reporteCitas.totalIngresos.toFixed(2)}`,
      "", "", "", "",
    ];

    exportarExcel(encabezados, [filas], "reporte-citas", "Reporte de Citas", { subtitulo, totales });
  };

  const handleExportarEmpleados = () => {
    if (!reporteIngresos?.porEmpleado.length) return;
    const fmtFecha = (iso: string) =>
      new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const subtitulo = `Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}`;
    const encabezados = ["Empleado", "Citas", "Ingresos", "Ticket promedio", "% del total"];
    const totalEquipoIngresos = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalIngresos, 0);
    const filas = reporteIngresos.porEmpleado
      .slice()
      .sort((a, b) => b.totalIngresos - a.totalIngresos)
      .map((e) => {
        const ticket = e.totalCitas > 0 ? e.totalIngresos / e.totalCitas : 0;
        const pct = totalEquipoIngresos > 0 ? (e.totalIngresos / totalEquipoIngresos) * 100 : 0;
        return [e.nombreEmpleado, e.totalCitas, `$${e.totalIngresos.toFixed(2)}`, `$${ticket.toFixed(2)}`, `${pct.toFixed(1)}%`];
      });
    exportarExcel(encabezados, [filas], "reporte-empleados", "Reporte por Empleado", { subtitulo });
  };

  const handleExportarIngresos = () => {
    if (!reporteIngresos?.porServicio.length) return;
    const fmtFecha = (iso: string) =>
      new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const subtitulo = `Período: ${fmtFecha(desde)} — ${fmtFecha(hasta)}`;
    const encabezados = ["Servicio", "Citas", "% del total", "Ingresos"];
    const filas = reporteIngresos.porServicio.map((s) => [
      s.nombreServicio, s.totalCitas, `${s.porcentaje.toFixed(1)}%`, `$${s.totalIngresos.toFixed(2)}`,
    ]);
    const totales: (string | number)[] = [
      "TOTAL", reporteIngresos.totalCitasCompletadas, "100%", `$${reporteIngresos.totalIngresos.toFixed(2)}`,
    ];
    exportarExcel(encabezados, [filas], "reporte-ingresos", "Reporte de Ingresos", { subtitulo, totales });
  };

  const inputCls = "px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-slate-700 bg-white";

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis de citas e ingresos</p>
        </div>
        {(tab === "citas" || tab === "ingresos" || tab === "empleados") && (
          <button
            onClick={
              tab === "citas" ? handleExportar
              : tab === "empleados" ? handleExportarEmpleados
              : handleExportarIngresos
            }
            disabled={
              tab === "citas" ? !reporteCitas?.citas.length
              : tab === "empleados" ? !reporteIngresos?.porEmpleado.length
              : !reporteIngresos?.porServicio.length
            }
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition"
          >
            <Download size={15} />
            Exportar Excel
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        {/* Presets de fechas */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {([
            { label: "Hoy", d: hoy(), h: hoy() },
            { label: "Esta semana", d: inicioSemana(), h: hoy() },
            { label: "Este mes", d: inicioMes(), h: hoy() },
            { label: "Este año", d: inicioAnio(), h: hoy() },
          ] as const).map((p) => (
            <button
              key={p.label}
              onClick={() => { setDesde(p.d); setHasta(p.h); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition ${
                desde === p.d && hasta === p.h
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-gray-600 border-gray-200 hover:border-slate-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-xs font-medium text-gray-600">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls}
              style={{ width: '100%', minWidth: 0, WebkitAppearance: 'none' }} />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-xs font-medium text-gray-600">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls}
              style={{ width: '100%', minWidth: 0, WebkitAppearance: 'none' }} />
          </div>
          {tab === "citas" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Empleado</label>
                <Select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                  <option value="">Todos</option>
                  {empleados.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Servicio</label>
                <Select value={servicioId} onChange={(e) => setServicioId(e.target.value)}>
                  <option value="">Todos</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Estado</label>
                <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option value="">Todos</option>
                  {ESTADOS_OPCIONES.map((o) => (
                    <option key={o.valor} value={o.valor}>{o.texto}</option>
                  ))}
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex bg-gray-100 p-1 rounded-lg min-w-max sm:min-w-0">
          {([
            { id: "citas", label: "Citas" },
            { id: "ingresos", label: "Ingresos" },
            { id: "empleados", label: "Empleados" },
            { id: "heatmap", label: "Horarios" },
            { id: "retencion", label: "Retención" },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Citas ── */}
      {tab === "citas" && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tarjeta label="Total citas" valor={String(reporteCitas?.totalCitas ?? "—")} icono={<Calendar size={18} />} />
            <Tarjeta label="Completadas" valor={String(reporteCitas?.totalCompletadas ?? "—")}
              subvalor={reporteCitas ? `${reporteCitas.totalCanceladas} canceladas` : undefined}
              icono={<CheckCircle size={18} />} />
            <Tarjeta label="Ingresos totales" valor={reporteCitas ? formatPrecio(reporteCitas.totalIngresos) : "—"} icono={<DollarSign size={18} />} />
            <Tarjeta label="Inasistencias" valor={String(reporteCitas?.totalInasistencias ?? "—")}
              subvalor={reporteCitas ? `${reporteCitas.totalPendientes} pendientes` : undefined}
              icono={<TrendingUp size={18} />} />
          </div>

          {/* Métodos de pago */}
          {reporteCitas && (reporteCitas.totalIngresosEfectivo > 0 || reporteCitas.totalIngresosTarjeta > 0) && (() => {
            const efectivo = reporteCitas.totalIngresosEfectivo;
            const tarjeta = reporteCitas.totalIngresosTarjeta;
            const transferencia = Math.max(0, reporteCitas.totalIngresos - efectivo - tarjeta);
            const total = efectivo + tarjeta + transferencia;
            const items = [
              { label: "Efectivo", valor: efectivo, color: "#10b981" },
              { label: "Tarjeta", valor: tarjeta, color: "#3b82f6" },
              { label: "Transferencia", valor: transferencia, color: "#8b5cf6" },
            ].filter((i) => i.valor > 0);
            return (
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Métodos de pago</h2>
                <div className="flex gap-4 flex-wrap mb-3">
                  {items.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 min-w-32">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-xs text-gray-500">{item.label}</p>
                        <p className="text-sm font-bold text-gray-900">{formatPrecio(item.valor)}</p>
                        <p className="text-xs text-gray-400">{total > 0 ? `${((item.valor / total) * 100).toFixed(0)}%` : "0%"}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full overflow-hidden flex">
                  {items.map((item) => (
                    <div
                      key={item.label}
                      className="h-full"
                      style={{ width: `${(item.valor / total) * 100}%`, backgroundColor: item.color }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Código", "Cliente", "Servicio", "Empleado", "Fecha", "Precio", "Pagada", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cargandoCitas ? (
                  <SkeletonTableRows filas={8} columnas={8} />
                ) : errorCitas ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-red-400 text-sm">
                      No se pudieron cargar las citas. Intenta cambiar el rango de fechas.
                    </td>
                  </tr>
                ) : !reporteCitas?.citas.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                      No hay citas en el rango seleccionado.
                    </td>
                  </tr>
                ) : (
                  reporteCitas.citas.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.codigoConfirmacion}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.nombreCliente}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.nombreServicio}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.nombreEmpleado}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatFecha(c.inicioEn)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{formatPrecio(c.precio)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.pagada
                          ? <span className="text-green-600 font-semibold text-xs">{c.metodoPago ?? "Sí"}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={c.estadoTexto} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Tab: Empleados ── */}
      {tab === "empleados" && (
        <>
          {cargandoIngresos ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : errorIngresos ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-red-400">
              No se pudieron cargar los datos. Intenta cambiar el rango de fechas.
            </div>
          ) : !reporteIngresos?.porEmpleado.length ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
              No hay datos de empleados en el rango seleccionado.
            </div>
          ) : (
            <>
              {/* Tarjetas resumen del equipo */}
              {(() => {
                const totalEquipoCitas = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalCitas, 0);
                const totalEquipoIngresos = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalIngresos, 0);
                const ticketPromedioEquipo = totalEquipoCitas > 0 ? totalEquipoIngresos / totalEquipoCitas : 0;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Tarjeta label="Citas del equipo" valor={String(totalEquipoCitas)} icono={<Calendar size={18} />} />
                    <Tarjeta label="Ingresos del equipo" valor={formatPrecio(totalEquipoIngresos)} icono={<DollarSign size={18} />} />
                    <Tarjeta label="Ticket promedio" valor={formatPrecio(ticketPromedioEquipo)} icono={<TrendingUp size={18} />} />
                  </div>
                );
              })()}

              {/* Gráfica de barras por empleado */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos por empleado</h2>
                <ResponsiveContainer width="100%" height={Math.max(200, reporteIngresos.porEmpleado.length * 52)}>
                  <BarChart
                    data={reporteIngresos.porEmpleado}
                    layout="vertical"
                    margin={{ left: 8, right: 32 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nombreEmpleado" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatPrecio(Number(v))} labelFormatter={(l) => `Empleado: ${l}`} />
                    <Bar dataKey="totalIngresos" radius={[0, 6, 6, 0]} maxBarSize={36}>
                      {reporteIngresos.porEmpleado.map((_, i) => (
                        <Cell key={i} fill={COLORES_GRAFICA[i % COLORES_GRAFICA.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tabla detallada por empleado */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Citas</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingresos</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Ticket promedio</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalEquipoIngresos = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalIngresos, 0);
                      return reporteIngresos.porEmpleado
                        .slice()
                        .sort((a, b) => b.totalIngresos - a.totalIngresos)
                        .map((e, i) => {
                          const ticket = e.totalCitas > 0 ? e.totalIngresos / e.totalCitas : 0;
                          const pct = totalEquipoIngresos > 0 ? (e.totalIngresos / totalEquipoIngresos) * 100 : 0;
                          const iniciales = e.nombreEmpleado.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
                          return (
                            <tr key={e.empleadoId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                    style={{ backgroundColor: COLORES_GRAFICA[i % COLORES_GRAFICA.length] }}
                                  >
                                    {iniciales}
                                  </div>
                                  <span className="font-medium text-gray-900">{e.nombreEmpleado}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right text-gray-600">{e.totalCitas}</td>
                              <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatPrecio(e.totalIngresos)}</td>
                              <td className="px-5 py-3 text-right text-gray-600">{formatPrecio(ticket)}</td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: COLORES_GRAFICA[i % COLORES_GRAFICA.length] }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Ingresos ── */}
      {tab === "ingresos" && (
        <>
          {/* Tarjetas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tarjeta label="Ingresos totales" valor={reporteIngresos ? formatPrecio(reporteIngresos.totalIngresos) : "—"} icono={<DollarSign size={18} />} />
            <Tarjeta label="Citas completadas" valor={String(reporteIngresos?.totalCitasCompletadas ?? "—")} icono={<CheckCircle size={18} />} />
            <Tarjeta label="Ticket promedio" valor={reporteIngresos ? formatPrecio(reporteIngresos.ticketPromedio) : "—"} icono={<TrendingUp size={18} />} />
          </div>

          {cargandoIngresos ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : errorIngresos ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-red-400">
              No se pudieron cargar los datos. Intenta cambiar el rango de fechas.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ingresos por servicio */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos por servicio</h2>
                {!reporteIngresos?.porServicio.length ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={reporteIngresos.porServicio} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="nombreServicio" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatPrecio(Number(v))} />
                      <Bar dataKey="totalIngresos" radius={[0, 4, 4, 0]}>
                        {reporteIngresos.porServicio.map((_, i) => (
                          <Cell key={i} fill={COLORES_GRAFICA[i % COLORES_GRAFICA.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Ingresos por día */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos por día</h2>
                {!reporteIngresos?.porDia.length ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin datos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={reporteIngresos.porDia} margin={{ right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatPrecio(Number(v))} />
                      <Bar dataKey="totalIngresos" fill="#C8A961" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Tabla por empleado */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden lg:col-span-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleado</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Citas</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!reporteIngresos?.porEmpleado.length ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-gray-400 text-sm">Sin datos</td>
                      </tr>
                    ) : (
                      reporteIngresos.porEmpleado.map((e) => (
                        <tr key={e.empleadoId} className="border-b border-gray-50 last:border-0">
                          <td className="px-5 py-3 font-medium text-gray-900">{e.nombreEmpleado}</td>
                          <td className="px-5 py-3 text-right text-gray-600">{e.totalCitas}</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatPrecio(e.totalIngresos)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Horarios (Heatmap) ── */}
      {tab === "heatmap" && (
        <>
          {cargandoHeatmap ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : !heatmap || heatmap.totalCitas === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
              No hay citas en el rango seleccionado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Tarjeta label="Total citas analizadas" valor={String(heatmap.totalCitas)} icono={<Calendar size={18} />} />
                <Tarjeta label="Hora pico" valor={heatmap.horaPico} subvalor="hora con más demanda" icono={<TrendingUp size={18} />} />
                <Tarjeta label="Día pico" valor={heatmap.diaPico} subvalor="día con más demanda" icono={<CheckCircle size={18} />} />
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">Ocupación por hora y día</h2>
                <p className="text-xs text-gray-400 mb-4">Número de citas por franja horaria. Más oscuro = más ocupado.</p>
                <div className="overflow-x-auto">
                  <div className="min-w-[480px]">
                    <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-1 mb-1">
                      <div />
                      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                        <div key={d} className="text-center text-xs font-semibold text-gray-500">{d}</div>
                      ))}
                    </div>
                    {Array.from({ length: 24 }, (_, hora) => (
                      <div key={hora} className="grid grid-cols-[40px_repeat(7,1fr)] gap-1 mb-1">
                        <div className="text-right text-xs text-gray-400 pr-2 self-center leading-none">
                          {hora % 3 === 0 ? `${hora}:00` : ""}
                        </div>
                        {Array.from({ length: 7 }, (_, dia) => {
                          const val = heatmap.matriz[hora]?.[dia] ?? 0;
                          const intensity = heatmap.maximo > 0 ? val / heatmap.maximo : 0;
                          const alpha = intensity === 0 ? 0 : Math.max(0.08, intensity);
                          return (
                            <div
                              key={dia}
                              title={val > 0 ? `${val} cita${val !== 1 ? "s" : ""}` : "Sin citas"}
                              className="h-7 rounded-md flex items-center justify-center text-xs font-medium cursor-default"
                              style={{
                                backgroundColor: val === 0 ? "#f1f5f9" : `rgba(51, 65, 85, ${alpha})`,
                                color: intensity > 0.55 ? "#ffffff" : intensity > 0.2 ? "#1e293b" : "#94a3b8",
                              }}
                            >
                              {val > 0 ? val : ""}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3 text-right">Zona horaria del negocio</p>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Retención ── */}
      {tab === "retencion" && (
        <>
          {cargandoRetencion ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : !retencion || retencion.totalClientes === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
              No hay datos de clientes en el rango seleccionado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tarjeta label="Total clientes" valor={String(retencion.totalClientes)} icono={<Users size={18} />} />
                <Tarjeta label="Clientes nuevos" valor={String(retencion.clientesNuevos)} subvalor="primera visita" icono={<TrendingUp size={18} />} />
                <Tarjeta label="Clientes recurrentes" valor={String(retencion.clientesRecurrentes)} subvalor="ya visitaron antes" icono={<RefreshCw size={18} />} />
                <Tarjeta label="Tasa de retención" valor={`${retencion.tasaRetencion.toFixed(1)}%`} subvalor="recurrentes / total" icono={<CheckCircle size={18} />} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Nuevos vs recurrentes</h2>
                  {(() => {
                    const total = retencion.totalClientes;
                    const pctNuevos = total > 0 ? (retencion.clientesNuevos / total) * 100 : 0;
                    const pctRecurrentes = total > 0 ? (retencion.clientesRecurrentes / total) * 100 : 0;
                    return (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">Nuevos</span>
                            <span className="text-gray-500">{retencion.clientesNuevos} ({pctNuevos.toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-400 rounded-full" style={{ width: `${pctNuevos}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">Recurrentes</span>
                            <span className="text-gray-500">{retencion.clientesRecurrentes} ({pctRecurrentes.toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pctRecurrentes}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Proyección del mes</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Ingreso actual</span>
                      <span className="font-semibold text-gray-900">{formatPrecio(retencion.ingresoMesActual)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Agendado pendiente</span>
                      <span className="font-semibold text-gray-900">{formatPrecio(retencion.ingresoAgendado)}</span>
                    </div>
                    <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
                      <span className="font-semibold text-gray-700">Proyección total</span>
                      <span className="font-bold text-slate-900">{formatPrecio(retencion.proyeccionMes)}</span>
                    </div>
                    {retencion.proyeccionMes > 0 && (
                      <div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-700 rounded-full"
                            style={{ width: `${Math.min(100, (retencion.ingresoMesActual / retencion.proyeccionMes) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          {retencion.diasRestantesMes} días restantes en el mes
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

    </div>
  );
}
