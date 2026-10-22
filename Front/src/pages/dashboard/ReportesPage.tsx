import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Tabs from "../../components/ui/Tabs";
import Pagination from "../../components/ui/Pagination";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { TAMANO_PAGINA } from "../../hooks/usePaginacionLocal";
import { FiltroBarra, type CampoFiltro } from "../../components/ui/filtros";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Download, TrendingUp, TrendingDown, Calendar, DollarSign, CheckCircle } from "lucide-react";
import { reportesApi, type FiltrosReporteCitas, type ReporteCitas } from "../../api/reportes";
import { mensajeError } from "../../utils/errores";
import { useSectorTerms } from "../../hooks/useSectorTerms";
import { Users, RefreshCw } from "lucide-react";
import { exportarExcel } from "../../utils/exportarExcel";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { SkeletonTableRows } from "../../components/ui/Skeleton";
import { formatPrecio, formatFechaHora as formatFecha } from "../../utils/formatters";
import { hoy, inicioSemana, inicioMes, finMes, inicioAnio, fechaLargaLocal } from "../../utils/fechas";
import { negociosApi } from "../../api/negocios";
import { useToastStore } from "../../store/toastStore";
import ErrorCarga from "../../components/ui/ErrorCarga";
import TablaDatosOculta from "../../components/ui/TablaDatosOculta";
import { COLOR_SERIE, EJE_LINEA, EJE_TICK, REJILLA, TOOLTIP, colorCategoria } from "../../lib/temaGraficas";
import { horasVisiblesHeatmap } from "../../lib/heatmap";

type Tab = "citas" | "ingresos" | "empleados" | "heatmap" | "retencion";

const REPORTE_PAGE_SIZE = TAMANO_PAGINA;

const ESTADOS_OPCIONES = [
  { valor: 1, texto: "Pendiente" },
  { valor: 2, texto: "Confirmada" },
  { valor: 3, texto: "Completada" },
  { valor: 4, texto: "Cancelada" },
  { valor: 5, texto: "Inasistencia" },
];

const MENSAJE_ERROR_EXCEL = "No se pudo generar el archivo de Excel. Intenta de nuevo.";
const DIAS_HEATMAP = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_HEATMAP_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const formatMoneda = (v: unknown) => `$${Number(v).toLocaleString("es-MX")}`;

function Tarjeta({ label, valor, subvalor, icono }: { label: string; valor: React.ReactNode; subvalor?: string; icono: React.ReactNode }) {
  return (
    <div className="relative bg-card border border-border rounded-xl p-4 min-w-[140px] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/50" />
      <div className="absolute top-3.5 right-3.5 text-muted-foreground/70">{icono}</div>
      <p className="text-xs font-medium text-muted-foreground mb-2 pr-7">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-foreground leading-none mb-1">{valor}</p>
      {subvalor && <p className="text-xs text-muted-foreground mt-1">{subvalor}</p>}
    </div>
  )
}

export default function ReportesPage() {
  const terms = useSectorTerms();
  const { toast } = useToastStore();
  const [tab, setTab] = useState<Tab>("citas");
  const [reportePagina, setReportePagina] = useState(1);
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [empleadoId, setEmpleadoId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [estado, setEstado] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);

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
    queryFn: () => serviciosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 5,
  });

  const RANGO_INICIAL = { desde: inicioMes(), hasta: hoy() };

  const camposFiltro: CampoFiltro[] = [
    {
      tipo: "rangoFechas",
      id: "periodo",
      etiqueta: "Período",
      desde,
      hasta,
      rangoNeutro: RANGO_INICIAL,
      onChange: (d, h) => {
        setDesde(d);
        setHasta(h);
        setErrorFecha(d > h ? "La fecha de inicio debe ser anterior a la de fin." : null);
      },
      presets: [
        { etiqueta: "Hoy", desde: hoy(), hasta: hoy() },
        { etiqueta: "Esta semana", desde: inicioSemana(), hasta: hoy() },
        { etiqueta: "Este mes", desde: inicioMes(), hasta: finMes() },
        { etiqueta: "Este año", desde: inicioAnio(), hasta: hoy() },
      ],
    },
    // Empleado, servicio y estado solo aplican al reporte de citas.
    ...(tab === "citas"
      ? ([
          {
            tipo: "select",
            id: "empleado",
            etiqueta: "Empleado",
            valor: empleadoId,
            onChange: setEmpleadoId,
            opciones: empleados.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
          },
          {
            tipo: "select",
            id: "servicio",
            etiqueta: "Servicio",
            valor: servicioId,
            onChange: setServicioId,
            opciones: servicios.map((s) => ({ valor: s.id, etiqueta: s.nombre })),
          },
          {
            tipo: "select",
            id: "estado",
            etiqueta: "Estado",
            valor: estado,
            onChange: setEstado,
            etiquetaNeutra: "Todos",
            opciones: ESTADOS_OPCIONES.map((o) => ({
              valor: String(o.valor),
              etiqueta: o.texto,
            })),
          },
        ] satisfies CampoFiltro[])
      : []),
  ];

  const limpiarFiltros = () => {
    setDesde(RANGO_INICIAL.desde);
    setHasta(RANGO_INICIAL.hasta);
    setEmpleadoId("");
    setServicioId("");
    setEstado("");
    setErrorFecha(null);
    setReportePagina(1);
  };


  const {
    data: reporteCitas, isLoading: cargandoCitas, isError: errorCitas,
    refetch: reintentarCitas, isFetching: actualizandoCitas,
  } = useQuery({
    queryKey: ["reporte-citas", filtros],
    queryFn: () => reportesApi.obtenerCitas(filtros),
    enabled: tab === "citas" && !errorFecha,
  });

  const {
    data: reporteIngresos, isLoading: cargandoIngresos, isError: errorIngresos,
    refetch: reintentarIngresos, isFetching: actualizandoIngresos,
  } = useQuery({
    queryKey: ["reporte-ingresos", desde, hasta],
    queryFn: () => reportesApi.obtenerIngresos(desde, hasta),
    enabled: (tab === "ingresos" || tab === "empleados") && !errorFecha,
  });

  const {
    data: heatmap, isLoading: cargandoHeatmap, isError: errorHeatmap,
    refetch: reintentarHeatmap, isFetching: actualizandoHeatmap,
  } = useQuery({
    queryKey: ["reporte-heatmap", desde, hasta],
    queryFn: () => reportesApi.obtenerHeatmap(desde, hasta),
    enabled: tab === "heatmap" && !errorFecha,
  });

  // Solo para recortar el mapa de calor a las horas de atención.
  const { data: horariosNegocio = [] } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: negociosApi.obtenerHorarios,
    enabled: tab === "heatmap",
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: retencion, isLoading: cargandoRetencion, isError: errorRetencion,
    refetch: reintentarRetencion, isFetching: actualizandoRetencion,
  } = useQuery({
    queryKey: ["reporte-retencion", desde, hasta],
    queryFn: () => reportesApi.obtenerRetencion(desde, hasta),
    enabled: tab === "retencion" && !errorFecha,
  });

  useEffect(() => { setReportePagina(1); }, [reporteCitas]);

  // Fechas locales: `new Date("YYYY-MM-DD")` es medianoche UTC y en México el
  // período salía un día antes en los dos extremos.
  const subtituloPeriodo = `Período: ${fechaLargaLocal(desde)} — ${fechaLargaLocal(hasta)}`;
  const avisarFalloExcel = () => toast(MENSAJE_ERROR_EXCEL, "error");

  // S7: el archivo lleva nombre, teléfono y correo de cada cliente, así que se pide
  // al servidor (que registra la exportación) en vez de reusar lo que hay en pantalla.
  const [exportandoCitas, setExportandoCitas] = useState(false);
  const handleExportar = async () => {
    if (!reporteCitas?.citas.length || exportandoCitas) return;
    setExportandoCitas(true);
    try {
      let reporte;
      try {
        reporte = await reportesApi.obtenerCitasExportacion(filtros);
      } catch (err) {
        toast(mensajeError(err, "No se pudo exportar el reporte. Intenta de nuevo."), "error");
        return;
      }
      await generarExcelCitas(reporte);
    } finally {
      setExportandoCitas(false);
    }
  };

  const generarExcelCitas = (reporteCitas: ReporteCitas) => {

    const encabezados = ["Código", "Cliente", "Teléfono", "Email", "Servicio", "Empleado", "Fecha", "Duración (min)", "Precio", "Pagada", "Método de pago", "Estado", "Notas"];
    const filas = reporteCitas.citas.map((c) => [
      c.codigoConfirmacion,
      c.nombreCliente,
      c.telefonoCliente ?? "",
      c.emailCliente ?? "",
      c.nombreServicio,
      c.nombreEmpleado,
      new Date(c.inicioEn),
      c.duracionMinutos,
      { moneda: c.precio },
      c.pagada ? "Sí" : "No",
      c.metodoPago ?? "",
      c.estadoTexto,
      c.notas ?? "",
    ]);

    const totalMinutos = reporteCitas.citas.reduce((s, c) => s + c.duracionMinutos, 0);
    const totales = [
      `${reporteCitas.totalCitas} ${terms.citas.toLowerCase()}`,
      "", "", "", "", "", "",
      totalMinutos,
      { moneda: reporteCitas.totalIngresos },
      "", "", "", "",
    ];

    return exportarExcel(encabezados, [filas], "reporte-citas", `Reporte de ${terms.citas}`, { subtitulo: subtituloPeriodo, totales })
      .catch(avisarFalloExcel);
  };

  const handleExportarEmpleados = () => {
    if (!reporteIngresos?.porEmpleado.length) return;
    const encabezados = ["Empleado", "Citas", "Ingresos", "Ticket promedio", "% del total"];
    const totalEquipoIngresos = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalIngresos, 0);
    const filas = reporteIngresos.porEmpleado
      .slice()
      .sort((a, b) => b.totalIngresos - a.totalIngresos)
      .map((e) => {
        const ticket = e.totalCitas > 0 ? e.totalIngresos / e.totalCitas : 0;
        const pct = totalEquipoIngresos > 0 ? (e.totalIngresos / totalEquipoIngresos) * 100 : 0;
        return [e.nombreEmpleado, e.totalCitas, { moneda: e.totalIngresos }, { moneda: ticket }, { porcentaje: pct }];
      });
    exportarExcel(encabezados, [filas], "reporte-empleados", "Reporte por Empleado", { subtitulo: subtituloPeriodo })
      .catch(avisarFalloExcel);
  };

  const handleExportarIngresos = () => {
    if (!reporteIngresos?.porServicio.length) return;
    const encabezados = ["Servicio", "Citas", "% del total", "Ingresos"];
    const filas = reporteIngresos.porServicio.map((s) => [
      s.nombreServicio, s.totalCitas, { porcentaje: s.porcentaje }, { moneda: s.totalIngresos },
    ]);
    const totales = [
      "TOTAL", reporteIngresos.totalCitasCompletadas, { porcentaje: 100 }, { moneda: reporteIngresos.totalIngresos },
    ];
    exportarExcel(encabezados, [filas], "reporte-ingresos", "Reporte de Ingresos", { subtitulo: subtituloPeriodo, totales })
      .catch(avisarFalloExcel);
  };

  const errorIngresosEnLinea = (
    <ErrorCarga
      mensaje="No se pudieron cargar los ingresos."
      onReintentar={() => reintentarIngresos()}
      reintentando={actualizandoIngresos}
    />
  );


  return (
    <div className="p-4 sm:p-8 space-y-6">
      <EncabezadoPagina
        titulo="Reportes"
        subtitulo="Análisis de citas e ingresos"
        acciones={
          (tab === "citas" || tab === "ingresos" || tab === "empleados") && (
            <BotonAccion
              variante="secundaria"
              onClick={
                tab === "citas" ? handleExportar
                : tab === "empleados" ? handleExportarEmpleados
                : handleExportarIngresos
              }
              disabled={
                tab === "citas" ? !reporteCitas?.citas.length || exportandoCitas
                : tab === "empleados" ? !reporteIngresos?.porEmpleado.length
                : !reporteIngresos?.porServicio.length
              }
            >
              <Download size={15} />
              Exportar Excel
            </BotonAccion>
          )
        }
      />

      {/* Tabs — antes iban debajo de los filtros, al revés que el resto del panel */}
      <Tabs
        etiqueta="Tipo de reporte"
        valor={tab}
        onChange={setTab}
        opciones={[
          { id: "citas", label: terms.citas },
          { id: "ingresos", label: "Ingresos" },
          { id: "empleados", label: "Empleados" },
          { id: "heatmap", label: "Horarios" },
          { id: "retencion", label: "Retención" },
        ]}
      />

      {/* Filtros */}
      <div>
        <FiltroBarra
          etiqueta="Filtros del reporte"
          className="mb-0"
          onLimpiar={limpiarFiltros}
          campos={camposFiltro}
        />
        {errorFecha && (
          <p role="alert" className="text-xs text-red-500 dark:text-red-400 mt-2">{errorFecha}</p>
        )}
      </div>

      {/* ── Tab: Citas ── */}
      {tab === "citas" && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tarjeta label={`Total ${terms.citas.toLowerCase()}`} valor={String(reporteCitas?.totalCitas ?? "—")} icono={<Calendar size={18} />} />
            <Tarjeta label="Completadas" valor={String(reporteCitas?.totalCompletadas ?? "—")}
              subvalor={reporteCitas ? `${reporteCitas.totalCanceladas} canceladas` : undefined}
              icono={<CheckCircle size={18} />} />
            <Tarjeta label="Ingresos totales" valor={reporteCitas ? formatPrecio(reporteCitas.totalIngresos) : "—"} icono={<DollarSign size={18} />} />
            <Tarjeta label="Inasistencias" valor={String(reporteCitas?.totalInasistencias ?? "—")}
              subvalor={reporteCitas ? `${reporteCitas.totalPendientes} pendientes` : undefined}
              icono={<TrendingDown size={18} />} />
          </div>

          {/* Métodos de pago */}
          {reporteCitas && (reporteCitas.totalIngresosEfectivo > 0 || reporteCitas.totalIngresosTarjeta > 0) && (() => {
            const efectivo = reporteCitas.totalIngresosEfectivo;
            const tarjeta = reporteCitas.totalIngresosTarjeta;
            const transferencia = Math.max(0, reporteCitas.totalIngresos - efectivo - tarjeta);
            const total = efectivo + tarjeta + transferencia;
            const items = [
              { label: "Efectivo", valor: efectivo, color: colorCategoria(3) },
              { label: "Tarjeta", valor: tarjeta, color: colorCategoria(0) },
              { label: "Transferencia", valor: transferencia, color: colorCategoria(1) },
            ].filter((i) => i.valor > 0);
            return (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Métodos de pago</h2>
                <div className="flex gap-4 flex-wrap mb-3">
                  {items.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 min-w-32">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatPrecio(item.valor)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{total > 0 ? `${((item.valor / total) * 100).toFixed(0)}%` : "0%"}</p>
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
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  {["Código", "Cliente", "Servicio", "Empleado", "Fecha", "Precio", "Pagada", "Estado"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
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
                    <td colSpan={8} className="p-0">
                      <ErrorCarga
                        className="border-0 rounded-none"
                        mensaje={`No se pudieron cargar las ${terms.citas.toLowerCase()}.`}
                        onReintentar={() => reintentarCitas()}
                        reintentando={actualizandoCitas}
                      />
                    </td>
                  </tr>
                ) : !reporteCitas?.citas.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500 text-sm">
                      {`No hay ${terms.citas.toLowerCase()} en el rango seleccionado.`}
                    </td>
                  </tr>
                ) : (
                  reporteCitas.citas
                    .slice((reportePagina - 1) * REPORTE_PAGE_SIZE, reportePagina * REPORTE_PAGE_SIZE)
                    .map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">{c.codigoConfirmacion}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">{c.nombreCliente}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{c.nombreServicio}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{c.nombreEmpleado}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatFecha(c.inicioEn)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatPrecio(c.precio)}</td>
                        <td className="px-4 py-3 text-center">
                          {c.pagada
                            ? <span className="text-green-600 font-semibold text-xs">{c.metodoPago ?? "Sí"}</span>
                            : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <EstadoBadge estado={c.estadoTexto} />
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>

            <Pagination
              pagina={reportePagina}
              totalPaginas={Math.max(1, Math.ceil((reporteCitas?.citas.length ?? 0) / REPORTE_PAGE_SIZE))}
              total={reporteCitas?.citas.length ?? 0}
              labelTotal={terms.citas.toLowerCase()}
              onCambiar={setReportePagina}
              cargando={cargandoCitas}
            />
          </div>
        </>
      )}

      {/* ── Tab: Empleados ── */}
      {tab === "empleados" && (
        <>
          {cargandoIngresos ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : errorIngresos ? (
            errorIngresosEnLinea
          ) : !reporteIngresos?.porEmpleado.length ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-10 text-center text-sm text-slate-400 dark:text-slate-500">
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
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Ingresos por empleado</h2>
                <ResponsiveContainer width="100%" height={Math.max(200, reporteIngresos.porEmpleado.length * 52)}>
                  <BarChart
                    accessibilityLayer
                    data={reporteIngresos.porEmpleado}
                    layout="vertical"
                    margin={{ left: 8, right: 32 }}
                  >
                    <CartesianGrid {...REJILLA} horizontal={false} />
                    <XAxis type="number" tickFormatter={formatMoneda} tick={EJE_TICK} axisLine={EJE_LINEA} tickLine={EJE_LINEA} />
                    <YAxis type="category" dataKey="nombreEmpleado" width={120} tick={EJE_TICK} axisLine={EJE_LINEA} tickLine={EJE_LINEA} />
                    <Tooltip {...TOOLTIP} formatter={(v) => formatPrecio(Number(v))} labelFormatter={(l) => `Empleado: ${l}`} />
                    <Bar dataKey="totalIngresos" name="Ingresos" fill={COLOR_SERIE} radius={[0, 6, 6, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
                <TablaDatosOculta
                  titulo="Ingresos por empleado"
                  columnas={["Empleado", "Ingresos"]}
                  filas={reporteIngresos.porEmpleado.map((e) => [e.nombreEmpleado, formatPrecio(e.totalIngresos)])}
                />
              </div>

              {/* Tabla detallada por empleado */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="px-3 py-3 w-8"></th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Empleado</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Citas</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Ingresos</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:table-cell">Ticket prom.</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalEquipoIngresos = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalIngresos, 0);
                      const ticketPromedioEquipo = reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalCitas, 0) > 0
                        ? totalEquipoIngresos / reporteIngresos.porEmpleado.reduce((s, e) => s + e.totalCitas, 0)
                        : 0;
                      return reporteIngresos.porEmpleado
                        .slice()
                        .sort((a, b) => b.totalIngresos - a.totalIngresos)
                        .map((e, i) => {
                          const ticket = e.totalCitas > 0 ? e.totalIngresos / e.totalCitas : 0;
                          const pct = totalEquipoIngresos > 0 ? (e.totalIngresos / totalEquipoIngresos) * 100 : 0;
                          const vsPromedio = ticketPromedioEquipo > 0 ? ((ticket - ticketPromedioEquipo) / ticketPromedioEquipo) * 100 : 0;
                          const iniciales = e.nombreEmpleado.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
                          return (
                            <tr key={e.empleadoId} className={`border-b border-slate-50 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition ${i === 0 ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
                              {/* Posición en número, no con medallas emoji (OM-32 / DC-35). */}
                              <td className="px-3 py-3 text-center">
                                <span className={`text-xs tabular-nums ${i === 0 ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                                  <span className="sr-only">Posición </span>{i + 1}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    aria-hidden="true"
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-foreground shrink-0"
                                  >
                                    {iniciales}
                                  </div>
                                  <span className="font-medium text-slate-900 dark:text-slate-100">{e.nombreEmpleado}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">{e.totalCitas}</td>
                              <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatPrecio(e.totalIngresos)}</td>
                              <td className="px-5 py-3 text-right hidden sm:table-cell">
                                <div>
                                  <span className="text-slate-600 dark:text-slate-400">{formatPrecio(ticket)}</span>
                                  {ticketPromedioEquipo > 0 && (
                                    <span className={`ml-1.5 text-xs font-semibold ${vsPromedio >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                      {vsPromedio >= 0 ? "↑" : "↓"}{Math.abs(vsPromedio).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, backgroundColor: COLOR_SERIE }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
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
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : errorIngresos ? (
            errorIngresosEnLinea
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ingresos por servicio */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{`Ingresos por ${terms.servicios.toLowerCase()}`}</h2>
                {!reporteIngresos?.porServicio.length ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Sin datos</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart accessibilityLayer data={reporteIngresos.porServicio} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid {...REJILLA} horizontal={false} />
                        <XAxis type="number" tickFormatter={formatMoneda} tick={EJE_TICK} axisLine={EJE_LINEA} tickLine={EJE_LINEA} />
                        <YAxis type="category" dataKey="nombreServicio" width={110} tick={EJE_TICK} axisLine={EJE_LINEA} tickLine={EJE_LINEA} />
                        <Tooltip {...TOOLTIP} formatter={(v) => formatPrecio(Number(v))} />
                        <Bar dataKey="totalIngresos" name="Ingresos" fill={COLOR_SERIE} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <TablaDatosOculta
                      titulo={`Ingresos por ${terms.servicios.toLowerCase()}`}
                      columnas={[terms.servicio, "Ingresos"]}
                      filas={reporteIngresos.porServicio.map((s) => [s.nombreServicio, formatPrecio(s.totalIngresos)])}
                    />
                  </>
                )}
              </div>

              {/* Ingresos por día */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Ingresos por día</h2>
                {!reporteIngresos?.porDia.length ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6">Sin datos</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart accessibilityLayer data={reporteIngresos.porDia} margin={{ right: 8 }}>
                        <CartesianGrid {...REJILLA} vertical={false} />
                        <XAxis dataKey="fecha" tick={{ ...EJE_TICK, fontSize: 10 }} axisLine={EJE_LINEA} tickLine={EJE_LINEA} interval="preserveStartEnd" />
                        <YAxis tickFormatter={formatMoneda} tick={EJE_TICK} axisLine={EJE_LINEA} tickLine={EJE_LINEA} />
                        <Tooltip {...TOOLTIP} formatter={(v) => formatPrecio(Number(v))} />
                        <Bar dataKey="totalIngresos" name="Ingresos" fill={COLOR_SERIE} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <TablaDatosOculta
                      titulo="Ingresos por día"
                      columnas={["Día", "Ingresos"]}
                      filas={reporteIngresos.porDia.map((d) => [d.fecha, formatPrecio(d.totalIngresos)])}
                    />
                  </>
                )}
              </div>

              {/* Tabla por empleado */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden lg:col-span-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Empleado</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Citas</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!reporteIngresos?.porEmpleado.length ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500 text-sm">Sin datos</td>
                      </tr>
                    ) : (
                      reporteIngresos.porEmpleado.map((e) => (
                        <tr key={e.empleadoId} className="border-b border-slate-50 dark:border-slate-700 last:border-0">
                          <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{e.nombreEmpleado}</td>
                          <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">{e.totalCitas}</td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatPrecio(e.totalIngresos)}</td>
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
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : errorHeatmap ? (
            <ErrorCarga
              mensaje="No se pudo cargar la ocupación por horario."
              onReintentar={() => reintentarHeatmap()}
              reintentando={actualizandoHeatmap}
            />
          ) : !heatmap || heatmap.totalCitas === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-10 text-center text-sm text-slate-400 dark:text-slate-500">
              {`No hay ${terms.citas.toLowerCase()} en el rango seleccionado.`}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Tarjeta label={`Total ${terms.citas.toLowerCase()} analizadas`} valor={String(heatmap.totalCitas)} icono={<Calendar size={18} />} />
                <Tarjeta label="Hora pico" valor={heatmap.horaPico} subvalor="hora con más demanda" icono={<TrendingUp size={18} />} />
                <Tarjeta label="Día pico" valor={heatmap.diaPico} subvalor="día con más demanda" icono={<CheckCircle size={18} />} />
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Ocupación por hora y día</h2>
                <p className="text-xs text-muted-foreground mb-4">{`Número de ${terms.citas.toLowerCase()} por franja horaria, dentro del horario de atención.`}</p>
                <div className="overflow-x-auto">
                  <div className="min-w-[480px]" role="table" aria-label={`${terms.citas} por hora y día de la semana`}>
                    <div role="row" className="grid grid-cols-[48px_repeat(7,1fr)] gap-1 mb-1">
                      <div role="columnheader" />
                      {DIAS_HEATMAP.map((d) => (
                        <div key={d} role="columnheader" className="text-center text-xs font-semibold text-muted-foreground">{d}</div>
                      ))}
                    </div>
                    {horasVisiblesHeatmap(heatmap.matriz, horariosNegocio).map((hora) => (
                      <div key={hora} role="row" className="grid grid-cols-[48px_repeat(7,1fr)] gap-1 mb-1">
                        <div role="rowheader" className="text-right text-xs text-muted-foreground pr-2 self-center leading-none tabular-nums">
                          {`${hora}:00`}
                        </div>
                        {Array.from({ length: 7 }, (_, dia) => {
                          const val = heatmap.matriz[hora]?.[dia] ?? 0;
                          const intensity = heatmap.maximo > 0 ? val / heatmap.maximo : 0;
                          const alpha = intensity === 0 ? 0 : Math.max(0.08, intensity);
                          const texto = val > 0 ? `${val} ${val === 1 ? terms.cita.toLowerCase() : terms.citas.toLowerCase()}` : `Sin ${terms.citas.toLowerCase()}`;
                          return (
                            <div
                              key={dia}
                              role="cell"
                              aria-label={`${DIAS_HEATMAP_LARGOS[dia]} ${hora}:00, ${texto}`}
                              title={texto}
                              className="h-7 rounded-md flex items-center justify-center text-xs font-medium cursor-default"
                              // Escala sobre el color del texto del tema (oscuro en claro,
                              // claro en oscuro): en dark mode el slate-700 fijo se perdía
                              // sobre la tarjeta y las celdas vacías eran cuadros blancos.
                              style={{
                                backgroundColor: val === 0 ? "hsl(var(--muted))" : `hsl(var(--foreground) / ${alpha})`,
                                color: intensity > 0.5 ? "hsl(var(--background))" : "hsl(var(--foreground))",
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
                {/* Leyenda: la intensidad sola no dice cuántas citas son. */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2" aria-label={`Escala: de 0 a ${heatmap.maximo} ${terms.citas.toLowerCase()}`}>
                    <span>0</span>
                    <div className="flex gap-0.5" aria-hidden="true">
                      {[0, 0.25, 0.5, 0.75, 1].map((a) => (
                        <span
                          key={a}
                          className="w-5 h-3 rounded-sm"
                          style={{ backgroundColor: a === 0 ? "hsl(var(--muted))" : `hsl(var(--foreground) / ${a})` }}
                        />
                      ))}
                    </div>
                    <span>{`${heatmap.maximo} ${heatmap.maximo === 1 ? terms.cita.toLowerCase() : terms.citas.toLowerCase()}`}</span>
                  </div>
                  <span>Zona horaria del negocio</span>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Retención ── */}
      {tab === "retencion" && (
        <>
          {cargandoRetencion ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-8 flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-2 border-slate-700 border-t-transparent rounded-full" />
            </div>
          ) : errorRetencion ? (
            <ErrorCarga
              mensaje="No se pudieron cargar los datos de retención."
              onReintentar={() => reintentarRetencion()}
              reintentando={actualizandoRetencion}
            />
          ) : !retencion || retencion.totalClientes === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-10 text-center text-sm text-slate-400 dark:text-slate-500">
              {`No hay datos de ${terms.clientes.toLowerCase()} en el rango seleccionado.`}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tarjeta label={`Total ${terms.clientes.toLowerCase()}`} valor={String(retencion.totalClientes)} icono={<Users size={18} />} />
                <Tarjeta label={`${terms.clientes} nuevos`} valor={String(retencion.clientesNuevos)} subvalor="primera visita" icono={<TrendingUp size={18} />} />
                <Tarjeta label={`${terms.clientes} recurrentes`} valor={String(retencion.clientesRecurrentes)} subvalor="ya visitaron antes" icono={<RefreshCw size={18} />} />
                <Tarjeta label="Tasa de retención" valor={`${retencion.tasaRetencion.toFixed(1)}%`} subvalor="recurrentes / total" icono={<CheckCircle size={18} />} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Nuevos vs recurrentes</h2>
                  {(() => {
                    const total = retencion.totalClientes;
                    const pctNuevos = total > 0 ? (retencion.clientesNuevos / total) * 100 : 0;
                    const pctRecurrentes = total > 0 ? (retencion.clientesRecurrentes / total) * 100 : 0;
                    return (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Nuevos</span>
                            <span className="text-slate-500 dark:text-slate-400">{retencion.clientesNuevos} ({pctNuevos.toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-categoria-3 rounded-full" style={{ width: `${pctNuevos}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Recurrentes</span>
                            <span className="text-slate-500 dark:text-slate-400">{retencion.clientesRecurrentes} ({pctRecurrentes.toFixed(1)}%)</span>
                          </div>
                          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-categoria-4 rounded-full" style={{ width: `${pctRecurrentes}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5">
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Proyección del mes</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Ingreso actual</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrecio(retencion.ingresoMesActual)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Agendado pendiente</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{formatPrecio(retencion.ingresoAgendado)}</span>
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-700 pt-2 flex justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Proyección total</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{formatPrecio(retencion.proyeccionMes)}</span>
                    </div>
                    {retencion.proyeccionMes > 0 && (
                      <div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-700 rounded-full"
                            style={{ width: `${Math.min(100, (retencion.ingresoMesActual / retencion.proyeccionMes) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-right">
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
