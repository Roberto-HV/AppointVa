import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { dashboardApi } from "../../api/dashboard";
import { citasApi } from "../../api/citas";
import { useAuthStore } from "../../store/authStore";
import EstadoBadge from "../../components/ui/EstadoBadge";
import { Skeleton } from "../../components/ui/Skeleton";

function formatPrecio(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
}

interface TarjetaProps { label: string; valor: string | number; color?: string }
function Tarjeta({ label, valor, color = "text-gray-900" }: TarjetaProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5">
      <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5 sm:mb-1 line-clamp-1">{label}</p>
      <p className={`text-lg sm:text-2xl font-bold leading-tight ${color}`}>{valor}</p>
    </div>
  );
}

function formatPrecioCorto(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// ── Vista del propietario ─────────────────────────────────────────────────────
function VistaPropietario({ nombre }: { nombre: string }) {
  const [dias, setDias] = useState(14);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-resumen"],
    queryFn: dashboardApi.obtenerResumen,
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const { data: tendencia = [] } = useQuery({
    queryKey: ["dashboard-tendencia", dias],
    queryFn: () => dashboardApi.obtenerTendencia(dias),
  });

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bienvenido, {nombre}</h1>
      <p className="text-gray-400 text-sm mb-8">Resumen de tu negocio</p>

      {isLoading ? (
        <>
          <Skeleton className="h-3 w-16 mb-3" />
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 sm:h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-3 w-16 mb-3" />
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            {[0,1,2].map(i => <Skeleton key={i} className="h-20 sm:h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-72 rounded-xl mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </>
      ) : data ? (
        <>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Citas</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <Tarjeta label="Hoy" valor={data.citasHoy} />
            <Tarjeta label="Semana" valor={data.citasSemana} />
            <Tarjeta label="Mes" valor={data.citasMes} />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ingresos</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
            <Tarjeta label="Hoy" valor={formatPrecioCorto(data.ingresosHoy)} color="text-primary" />
            <Tarjeta label="Semana" valor={formatPrecioCorto(data.ingresosSemana)} color="text-primary" />
            <Tarjeta label="Mes" valor={formatPrecioCorto(data.ingresosMes)} color="text-primary" />
          </div>

          {/* Gráfica de tendencia con selector de período */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-700">Ingresos y citas por día</h2>
              <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDias(d)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                      dias === d ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
                      <stop offset="5%" stopColor="#C8A961" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#C8A961" stopOpacity={0} />
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
                  <Area yAxisId="citas" type="monotone" dataKey="citas" stroke="#C8A961" strokeWidth={2} fill="url(#gradCitas)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Próximas citas</h2>
              {data.proximasCitas.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay citas próximas</p>
              ) : (
                <div className="space-y-3">
                  {data.proximasCitas.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.nombreCliente}</p>
                        <p className="text-xs text-gray-400">{c.nombreServicio} · {c.nombreEmpleado}</p>
                        <p className="text-xs text-gray-400 capitalize">{formatFechaHora(c.inicioEn)}</p>
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
                          className="bg-primary h-1.5 rounded-full"
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
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">
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
                  <p className="text-xs text-gray-400 capitalize">{formatFechaHora(c.inicioEn)}</p>
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
                  <p className="text-xs text-gray-400 capitalize">{formatFechaHora(c.inicioEn)}</p>
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
