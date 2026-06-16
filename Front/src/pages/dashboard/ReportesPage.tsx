import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Select from "../../components/ui/Select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Download, TrendingUp, Calendar, DollarSign, CheckCircle } from "lucide-react";
import { reportesApi, type FiltrosReporteCitas } from "../../api/reportes";

const DIAS_HEATMAP = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function HeatmapCell({ valor, maximo }: { valor: number; maximo: number }) {
  const intensidad = maximo > 0 ? valor / maximo : 0;
  const bg = intensidad === 0
    ? "#f9fafb"
    : `rgba(200,169,97,${Math.min(0.15 + intensidad * 0.85, 1)})`;
  const text = intensidad > 0.6 ? "#5a3e10" : intensidad > 0 ? "#7a5c1e" : "#d1d5db";
  return (
    <div
      className="h-6 flex items-center justify-center rounded text-[10px] font-medium"
      style={{ backgroundColor: bg, color: text }}
      title={`${valor} cita${valor !== 1 ? "s" : ""}`}
    >
      {valor > 0 ? valor : ""}
    </div>
  );
}
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { SkeletonTableRows } from "../../components/ui/Skeleton";

type Tab = "citas" | "ingresos" | "empleados" | "analitica";

const ESTADOS_OPCIONES = [
  { valor: 1, texto: "Pendiente" },
  { valor: 2, texto: "Confirmada" },
  { valor: 3, texto: "Completada" },
  { valor: 4, texto: "Cancelada" },
  { valor: 5, texto: "Inasistencia" },
];

const COLORES_GRAFICA = ["#C8A961", "#a88b45", "#e8d4a0", "#7a6530", "#d4bc80"];

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
}

function hoy() {
  return new Date().toISOString().split("T")[0];
}

function inicioMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

interface TarjetaProps { label: string; valor: string; subvalor?: string; icono: React.ReactNode }
function Tarjeta({ label, valor, subvalor, icono }: TarjetaProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-4">
      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
        {icono}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{valor}</p>
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
  const [exportando, setExportando] = useState(false);

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

  const { data: reporteCitas, isLoading: cargandoCitas } = useQuery({
    queryKey: ["reporte-citas", filtros],
    queryFn: () => reportesApi.obtenerCitas(filtros),
    enabled: tab === "citas",
  });

  const { data: reporteIngresos, isLoading: cargandoIngresos } = useQuery({
    queryKey: ["reporte-ingresos", desde, hasta],
    queryFn: () => reportesApi.obtenerIngresos(desde, hasta),
    enabled: tab === "ingresos" || tab === "empleados",
  });

  const { data: heatmap, isLoading: cargandoHeatmap } = useQuery({
    queryKey: ["heatmap", desde, hasta],
    queryFn: () => reportesApi.obtenerHeatmap(desde, hasta),
    enabled: tab === "analitica",
  });

  const { data: retencion, isLoading: cargandoRetencion } = useQuery({
    queryKey: ["retencion", desde, hasta],
    queryFn: () => reportesApi.obtenerRetencion(desde, hasta),
    enabled: tab === "analitica",
  });

  const handleExportar = async () => {
    setExportando(true);
    try {
      await reportesApi.exportarCitasCsv(filtros);
    } finally {
      setExportando(false);
    }
  };

  const inputCls = "px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-primary bg-white";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Análisis de citas e ingresos</p>
        </div>
        {tab === "citas" && (
          <button
            onClick={handleExportar}
            disabled={exportando || !reporteCitas?.citas.length}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition"
          >
            <Download size={15} />
            {exportando ? "Exportando..." : "Exportar CSV"}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
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

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {([
          { id: "citas", label: "Citas" },
          { id: "ingresos", label: "Ingresos" },
          { id: "empleados", label: "Empleados" },
          { id: "analitica", label: "Analítica" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
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
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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

      {/* ── Tab: Analítica ── */}
      {tab === "analitica" && (
        <>
          {(cargandoHeatmap || cargandoRetencion) ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Cards de retención */}
              {retencion && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 font-medium">Tasa de retención</p>
                    <p className="text-2xl font-bold text-primary mt-1">{retencion.tasaRetencion}%</p>
                    <p className="text-xs text-gray-400 mt-0.5">{retencion.clientesRecurrentes} de {retencion.totalClientes} clientes volvieron</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 font-medium">Clientes nuevos</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{retencion.clientesNuevos}</p>
                    <p className="text-xs text-gray-400 mt-0.5">en el período seleccionado</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 font-medium">Ingreso completado (mes)</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrecio(retencion.ingresoMesActual)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatPrecio(retencion.ingresoAgendado)} ya agendado</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs text-gray-500 font-medium">Proyección del mes</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{formatPrecio(retencion.proyeccionMes)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{retencion.diasRestantesMes} días restantes</p>
                  </div>
                </div>
              )}

              {/* Heatmap */}
              {heatmap && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">Horas pico</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {heatmap.totalCitas} citas analizadas ·
                        Pico: <span className="font-medium text-gray-600">{heatmap.diaPico} {heatmap.horaPico}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>Pocas</span>
                      {[0.1, 0.3, 0.55, 0.75, 1].map((i) => (
                        <div key={i} className="w-5 h-4 rounded" style={{ backgroundColor: `rgba(200,169,97,${i})` }} />
                      ))}
                      <span>Muchas</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[520px]">
                      {/* Cabecera días */}
                      <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}>
                        <div />
                        {DIAS_HEATMAP.map((d) => (
                          <div key={d} className="text-center text-xs font-medium text-gray-500">{d}</div>
                        ))}
                      </div>
                      {/* Filas de horas (solo 7am–10pm) */}
                      {heatmap.matriz.slice(7, 22).map((fila, i) => {
                        const hora = i + 7;
                        return (
                          <div key={hora} className="grid gap-1 mb-1" style={{ gridTemplateColumns: "36px repeat(7, 1fr)" }}>
                            <div className="text-xs text-gray-400 text-right pr-2 leading-6">
                              {hora}:00
                            </div>
                            {fila.map((val, d) => (
                              <HeatmapCell key={d} valor={val} maximo={heatmap.maximo} />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
