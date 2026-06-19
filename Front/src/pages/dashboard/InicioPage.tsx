import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CheckCircle2, Circle, X, Scissors, Users, Link2, CalendarDays, BarChart2, UserCheck } from "lucide-react";
import { dashboardApi } from "../../api/dashboard";
import { citasApi } from "../../api/citas";
import { negociosApi } from "../../api/negocios";
import { useAuthStore } from "../../store/authStore";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { Skeleton } from "../../components/ui/Skeleton";
import AnimatedCounter from "../../components/ui/AnimatedCounter";
import { formatPrecio, formatFechaHoraResumen as formatFechaHora } from "../../utils/formatters";

interface TarjetaProps { label: string; valor?: string | number; rawValue?: number; valorCorto?: string; color?: string; accent?: boolean }
function Tarjeta({ label, valor, rawValue, color = "text-slate-900", accent = false }: TarjetaProps) {
  const numCls = `text-xl sm:text-2xl font-black leading-none ${accent ? "text-white" : color}`;
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 transition-all ${accent ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}>
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-1.5 line-clamp-1 text-slate-400">{label}</p>
      {typeof valor === "number" ? (
        <AnimatedCounter to={valor} className={numCls} />
      ) : rawValue !== undefined ? (
        <p className={numCls}>
          <AnimatedCounter to={rawValue} format={formatPrecioCorto} className="sm:hidden" />
          <AnimatedCounter to={rawValue} format={(n) => formatPrecio(n)} className="hidden sm:inline" />
        </p>
      ) : (
        <p className={numCls}>{valor}</p>
      )}
    </div>
  );
}

function formatPrecioCorto(n: number) {
  if (n >= 10000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

// ── Wizard de onboarding ──────────────────────────────────────────────────────
interface OnboardingProps {
  negocioId: string;
  slug: string;
  tieneCitas: boolean;
  tieneServicios: boolean;
}

function WizardOnboarding({ negocioId, slug, tieneCitas, tieneServicios }: OnboardingProps) {
  const keyStorage = `onboarding-ok-${negocioId}`;
  const [cerrado, setCerrado] = useState(() => !!localStorage.getItem(keyStorage));

  if (cerrado || tieneCitas) return null;

  const cerrar = () => {
    localStorage.setItem(keyStorage, "1");
    setCerrado(true);
  };

  const pasos = [
    { hecho: true,           icono: CheckCircle2, label: "Cuenta creada", desc: "Tu negocio está registrado en AppointVa", accion: null },
    { hecho: tieneServicios, icono: Scissors,     label: "Agrega servicios", desc: "Define los servicios que ofreces y sus precios", accion: { href: "/dashboard/servicios", texto: "Ir a Servicios" } },
    { hecho: false,          icono: Users,         label: "Agrega tu equipo", desc: "Registra empleados para asignar citas", accion: { href: "/dashboard/empleados", texto: "Ir a Empleados" } },
    { hecho: false,          icono: Link2,          label: "Comparte tu enlace", desc: `Envía este link a tus clientes para que reserven`, accion: null, link: `${window.location.origin}/b/${slug}` },
  ];

  const hechos = pasos.filter((p) => p.hecho).length;
  const pct = Math.round((hechos / pasos.length) * 100);

  return (
    <div className="bg-white rounded-xl border border-slate-700/20 p-5 mb-6 relative">
      <button onClick={cerrar} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
        <X size={16} />
      </button>

      <div className="flex items-center justify-between mb-1 pr-6">
        <h3 className="text-sm font-bold text-gray-800">Configura tu negocio</h3>
        <span className="text-xs font-semibold text-slate-700">{hechos}/{pasos.length} completados</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
        <div className="bg-slate-700 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-3">
        {pasos.map((p, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${p.hecho ? "bg-gray-50" : "bg-slate-700/5 border border-slate-700/10"}`}>
            <div className={`mt-0.5 shrink-0 ${p.hecho ? "text-emerald-500" : "text-slate-700"}`}>
              {p.hecho ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${p.hecho ? "text-gray-400 line-through" : "text-gray-800"}`}>{p.label}</p>
              {!p.hecho && <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>}
              {!p.hecho && p.link && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded text-slate-700 truncate max-w-[200px] sm:max-w-xs">{p.link}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(p.link!)}
                    className="text-xs text-slate-700 font-semibold hover:underline shrink-0"
                  >
                    Copiar
                  </button>
                </div>
              )}
            </div>
            {!p.hecho && p.accion && (
              <Link to={p.accion.href} className="shrink-0 text-xs font-semibold text-slate-700 bg-slate-700/10 hover:bg-slate-700/20 px-3 py-1.5 rounded-lg transition">
                {p.accion.texto}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vista del propietario ─────────────────────────────────────────────────────
function VistaPropietario({ nombre }: { nombre: string }) {
  const [dias, setDias] = useState(14);
  const usuario = useAuthStore((s) => s.usuario);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-resumen"],
    queryFn: dashboardApi.obtenerResumen,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: negocio } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 1000 * 60 * 10,
  });

  const { data: tendencia = [] } = useQuery({
    queryKey: ["dashboard-tendencia", dias],
    queryFn: () => dashboardApi.obtenerTendencia(dias),
  });

  return (
    <div className="p-4 sm:p-8">
      {/* Encabezado — Apple Store style */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900 leading-none mb-1">Hola, {nombre}</h1>
        <p className="text-sm text-slate-400">{negocio?.nombre ?? "Tu negocio"}</p>
      </div>

      {/* Quick actions — ElevenReader 4-col grid */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        className="grid grid-cols-4 gap-2 sm:gap-3 mb-6"
      >
        {[
          { label: "Citas", icon: CalendarDays, to: "/dashboard/citas" },
          { label: "Servicios", icon: Scissors, to: "/dashboard/servicios" },
          { label: "Clientes", icon: UserCheck, to: "/dashboard/clientes" },
          { label: "Reportes", icon: BarChart2, to: "/dashboard/reportes" },
        ].map(({ label, icon: Icon, to }) => (
          <motion.div
            key={to}
            variants={{ hidden: { opacity: 0, y: 12, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "easeOut" } } }}
          >
            <Link
              to={to}
              className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-slate-100 p-3 hover:border-slate-200 hover:-translate-y-0.5 hover:shadow-md transition group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-slate-100 flex items-center justify-center transition">
                <Icon size={18} className="text-slate-600" />
              </div>
              <span className="text-[10px] font-semibold text-slate-500 text-center leading-tight">{label}</span>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {negocio && usuario?.negocioId && (
        <WizardOnboarding
          negocioId={usuario.negocioId}
          slug={negocio.slug}
          tieneCitas={(data?.citasMes ?? 0) > 0}
          tieneServicios={(data?.topServicios?.length ?? 0) > 0}
        />
      )}

      {isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 sm:h-24 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 sm:h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </>
      ) : data ? (
        <>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Citas</p>
          <motion.div
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-3 gap-2 sm:gap-3 mb-6"
          >
            {[
              { label: "Hoy", valor: data.citasHoy },
              { label: "Semana", valor: data.citasSemana },
              { label: "Mes", valor: data.citasMes },
            ].map(({ label, valor }) => (
              <motion.div key={label} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}>
                <Tarjeta label={label} valor={valor} />
              </motion.div>
            ))}
          </motion.div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Ingresos</p>
          <motion.div
            initial="hidden" animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="grid grid-cols-3 gap-2 sm:gap-3 mb-8"
          >
            {[
              { label: "Hoy", rawValue: data.ingresosHoy },
              { label: "Semana", rawValue: data.ingresosSemana },
              { label: "Mes", rawValue: data.ingresosMes },
            ].map(({ label, rawValue }) => (
              <motion.div key={label} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}>
                <Tarjeta label={label} rawValue={rawValue} accent />
              </motion.div>
            ))}
          </motion.div>

          {/* Gráfica de tendencia */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-800">Ingresos y citas por día</h2>
              <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDias(d)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      dias === d ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            {tendencia.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos para este período</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={tendencia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="ingresos" tickFormatter={formatPrecioCorto} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
                  <YAxis yAxisId="citas" orientation="right" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip
                    formatter={(val, name) =>
                      name === "ingresos" ? [formatPrecio(Number(val)), "Ingresos"] : [Number(val), "Citas"]
                    }
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(v) => v === "ingresos" ? "Ingresos" : "Citas"}
                  />
                  <Area yAxisId="ingresos" type="monotone" dataKey="ingresos" stroke="#7c3aed" strokeWidth={2} fill="url(#gradIngresos)" dot={false} />
                  <Area yAxisId="citas" type="monotone" dataKey="citas" stroke="#0D9488" strokeWidth={2} fill="url(#gradCitas)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Highlight próxima cita */}
          {data.proximasCitas.length > 0 && (() => {
            const proxima = data.proximasCitas[0];
            const msRestantes = new Date(proxima.inicioEn).getTime() - Date.now();
            const minutos = Math.round(msRestantes / 60000);
            const esHoy = msRestantes > 0 && msRestantes < 24 * 60 * 60 * 1000;
            const etiqueta = msRestantes <= 0
              ? "En curso"
              : minutos < 60
              ? `En ${minutos} min`
              : minutos < 1440
              ? `En ${Math.floor(minutos / 60)}h ${minutos % 60 > 0 ? `${minutos % 60}min` : ""}`
              : null;
            if (!esHoy && !etiqueta) return null;
            return (
              <div className="bg-slate-700/5 border border-slate-700/20 rounded-xl p-4 mb-6 flex items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-700/15 flex items-center justify-center shrink-0">
                    <span className="text-lg">📅</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-700 font-semibold uppercase tracking-wide mb-0.5">Próxima cita</p>
                    <p className="font-semibold text-gray-900 truncate">{proxima.nombreCliente}</p>
                    <p className="text-xs text-gray-500 truncate">{proxima.nombreServicio} · {proxima.nombreEmpleado}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {etiqueta && (
                    <p className={`text-sm font-bold ${msRestantes <= 0 ? "text-green-600" : "text-slate-700"}`}>{etiqueta}</p>
                  )}
                  <p className="text-xs text-gray-400">{formatFechaHora(proxima.inicioEn)}</p>
                  <EstadoBadge estado={proxima.estadoTexto} />
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Próximas citas</h2>
              {data.proximasCitas.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay citas próximas</p>
              ) : (
                <div className="space-y-3">
                  {data.proximasCitas.map((c, idx) => (
                    <div key={c.id} className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0 ${idx === 0 ? "opacity-50" : ""}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.nombreCliente}</p>
                        <p className="text-xs text-gray-400">{c.nombreServicio} · {c.nombreEmpleado}</p>
                        <p className="text-xs text-gray-400">{formatFechaHora(c.inicioEn)}</p>
                      </div>
                      <EstadoBadge estado={c.estadoTexto} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Top servicios</h2>
              {data.topServicios.length === 0 ? (
                <p className="text-gray-400 text-sm">Sin datos aún</p>
              ) : (
                <div className="space-y-3">
                  {data.topServicios.map((s, i) => (
                    <div key={s.nombre}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-600 font-medium">{i + 1}. {s.nombre}</span>
                        <span className="text-xs text-gray-400">{s.totalCitas} citas</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-slate-700 h-1.5 rounded-full"
                          style={{ width: `${Math.min((s.totalCitas / (data.topServicios[0]?.totalCitas || 1)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Vista del empleado ────────────────────────────────────────────────────────
function VistaEmpleado({ nombre }: { nombre: string }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const manana = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().slice(0, 10);

  const { data: citasHoy = [], isLoading: cargandoHoy } = useQuery({
    queryKey: ["mis-citas-hoy"],
    queryFn: () => citasApi.obtenerTodas({ desde: hoy, hasta: hoy }),
    select: (p) => p.datos,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: citasProximas = [], isLoading: cargandoProximas } = useQuery({
    queryKey: ["mis-citas-proximas"],
    queryFn: () => citasApi.obtenerTodas({ desde: manana }),
    select: (p) => p.datos,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const pendientesOConfirmadas = citasProximas.filter(
    (c) => c.estadoTexto === "Pendiente" || c.estadoTexto === "Confirmada"
  ).slice(0, 10);

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Hola, {nombre}</h1>
      <p className="text-gray-400 text-sm mb-8">Tu agenda de hoy</p>

      {/* Citas de hoy */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Citas de hoy</h2>
          <span className="text-xs bg-slate-700/10 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
            {cargandoHoy ? "..." : citasHoy.length}
          </span>
        </div>

        {cargandoHoy ? (
          <div className="space-y-3">
            {[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : citasHoy.length === 0 ? (
          <p className="text-gray-400 text-sm">No tienes citas programadas para hoy</p>
        ) : (
          <div className="space-y-3">
            {citasHoy.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.nombreCliente}</p>
                  <p className="text-xs text-gray-500">{c.nombreServicio} · {c.duracionMinutos} min</p>
                  <p className="text-xs text-gray-400">{formatFechaHora(c.inicioEn)}</p>
                </div>
                <div className="text-right">
                  <EstadoBadge estado={c.estadoTexto} />
                  <p className="text-xs font-semibold text-gray-700 mt-1">
                    {formatPrecio(c.precio)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Próximas citas */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Próximas citas</h2>
        {cargandoProximas ? (
          <div className="space-y-2">
            {[0,1,2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : pendientesOConfirmadas.length === 0 ? (
          <p className="text-gray-400 text-sm">No tienes citas próximas pendientes</p>
        ) : (
          <div className="space-y-2">
            {pendientesOConfirmadas.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.nombreCliente}</p>
                  <p className="text-xs text-gray-400">{c.nombreServicio}</p>
                  <p className="text-xs text-gray-400">{formatFechaHora(c.inicioEn)}</p>
                </div>
                <EstadoBadge estado={c.estadoTexto} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function InicioPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const nombre = usuario?.nombreCompleto?.split(" ")[0] ?? "";

  if (usuario?.rol === "Empleado") return <VistaEmpleado nombre={nombre} />;
  return <VistaPropietario nombre={nombre} />;
}
