import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { useAuthStore } from "../../store/authStore";
import type { CitaDto } from "../../types";

const HORA_INICIO = 7;
const HORA_FIN = 21;
const PX_POR_HORA = 56;
const GRID_H = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;
const COL_MIN_W = 148;

const ESTADO_BG: Record<string, string> = {
  Pendiente:    "bg-amber-400 hover:bg-amber-500",
  Confirmada:   "bg-emerald-500 hover:bg-emerald-600",
  Completada:   "bg-slate-300 hover:bg-slate-400",
  Cancelada:    "bg-red-100 hover:bg-red-200 border border-red-300",
  Inasistencia: "bg-orange-100 hover:bg-orange-200 border border-orange-300",
};

const ESTADO_TEXT: Record<string, string> = {
  Pendiente:    "text-white",
  Confirmada:   "text-white",
  Completada:   "text-slate-500",
  Cancelada:    "text-red-400 line-through",
  Inasistencia: "text-orange-500",
};

const EMP_COLORS = [
  "#4F46E5", "#7C3AED", "#0891B2", "#059669",
  "#D97706", "#DC2626", "#DB2777", "#0F766E",
];

const LEYENDA = [
  { label: "Confirmada", cls: "bg-emerald-500" },
  { label: "Completada", cls: "bg-slate-300" },
  { label: "Cancelada",  cls: "bg-red-100 border border-red-300" },
];

function horaLabel(h: number): string {
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function calcTop(iso: string): number {
  const d = new Date(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, (h - HORA_INICIO) * PX_POR_HORA);
}

function calcAltura(min: number): number {
  return Math.max(22, (min / 60) * PX_POR_HORA);
}

function fechaLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function navFecha(base: string, delta: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface Props {
  onCitaClick: (cita: CitaDto) => void;
}

export default function GanttCitas({ onCitaClick }: Props) {
  const hoy = fechaLocal();
  const [fecha, setFecha] = useState(hoy);
  const [nowTop, setNowTop] = useState<number | null>(null);
  const usuario = useAuthStore((s) => s.usuario);
  const esEmpleado = usuario?.rol === "Empleado";

  useEffect(() => {
    const calc = () => {
      const n = new Date();
      const h = n.getHours() + n.getMinutes() / 60;
      setNowTop(h >= HORA_INICIO && h <= HORA_FIN ? (h - HORA_INICIO) * PX_POR_HORA : null);
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["citas-gantt", fecha],
    queryFn: () => citasApi.obtenerTodas({ desde: fecha, hasta: fecha, tamano: 200 }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const citas = data?.datos ?? [];

  const { data: empleados = [] } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 5,
  });

  const activos = empleados.filter((e) => e.activo);
  const conCitas = activos.filter((e) => citas.some((c) => c.empleadoId === e.id));

  let emps: typeof activos;
  if (esEmpleado) {
    const miEmpleado = activos.find((e) => e.email === usuario?.email);
    emps = miEmpleado ? [miEmpleado] : conCitas;
  } else {
    emps = conCitas.length > 0 ? conCitas : activos;
  }

  const porEmp = new Map<string, CitaDto[]>(emps.map((e) => [e.id, []]));
  citas.forEach((c) => {
    const arr = porEmp.get(c.empleadoId);
    if (arr) arr.push(c);
  });

  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const citasActivas = citas.filter((c) => c.estadoTexto !== "Cancelada" && c.estadoTexto !== "Inasistencia");

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFecha(navFecha(fecha, -1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 text-sm leading-none"
            aria-label="Día anterior"
          >
            ←
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-slate-700 cursor-pointer"
          />
          <button
            onClick={() => setFecha(navFecha(fecha, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 text-sm leading-none"
            aria-label="Día siguiente"
          >
            →
          </button>
        </div>
        <button
          onClick={() => setFecha(hoy)}
          disabled={fecha === hoy}
          className="text-xs text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition"
        >
          Hoy
        </button>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-gray-400">
            {isLoading ? "Cargando..." : `${citasActivas.length} cita${citasActivas.length !== 1 ? "s" : ""}`}
          </span>
          <div className="hidden sm:flex items-center gap-3">
            {LEYENDA.map(({ label, cls }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
                <span className="text-[11px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">
          Cargando jornada...
        </div>
      ) : emps.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-gray-400">
          No hay empleados activos
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 56 + emps.length * COL_MIN_W }}>

            {/* Employee header row */}
            <div className="flex border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
              <div className="w-14 flex-shrink-0 border-r border-gray-100" />
              {emps.map((emp, i) => {
                const empCitas = (porEmp.get(emp.id) ?? []).filter(
                  (c) => c.estadoTexto !== "Cancelada" && c.estadoTexto !== "Inasistencia"
                );
                return (
                  <div
                    key={emp.id}
                    className="flex-1 flex flex-col items-center py-3 border-r border-gray-100 last:border-r-0"
                    style={{ minWidth: COL_MIN_W }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-1.5 flex-shrink-0"
                      style={{ background: EMP_COLORS[i % EMP_COLORS.length] }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-gray-800 truncate max-w-[120px] px-1 leading-tight">
                      {emp.nombre}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {empCitas.length > 0
                        ? `${empCitas.length} cita${empCitas.length !== 1 ? "s" : ""}`
                        : "Sin citas"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="flex relative" style={{ height: GRID_H }}>

              {/* Time labels */}
              <div className="w-14 flex-shrink-0 border-r border-gray-100 relative">
                {horas.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 flex justify-end pr-2"
                    style={{ top: (h - HORA_INICIO) * PX_POR_HORA - 7 }}
                  >
                    <span className="text-[10px] text-gray-400 font-medium">{horaLabel(h)}</span>
                  </div>
                ))}
              </div>

              {/* Horizontal grid lines */}
              <div className="absolute left-14 right-0 top-0 bottom-0 pointer-events-none">
                {horas.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: (h - HORA_INICIO) * PX_POR_HORA }}
                  />
                ))}
                {horas.map((h) => (
                  <div
                    key={h + 0.5}
                    className="absolute left-0 right-0 border-t border-gray-50"
                    style={{ top: (h - HORA_INICIO + 0.5) * PX_POR_HORA }}
                  />
                ))}
              </div>

              {/* Employee columns */}
              {emps.map((emp) => (
                <div
                  key={emp.id}
                  className="flex-1 relative border-r border-gray-100 last:border-r-0"
                  style={{ minWidth: COL_MIN_W }}
                >
                  {(porEmp.get(emp.id) ?? []).map((cita) => {
                    const top = calcTop(cita.inicioEn);
                    const height = calcAltura(cita.duracionMinutos);
                    const bg = ESTADO_BG[cita.estadoTexto] ?? "bg-gray-100 hover:bg-gray-200";
                    const textCls = ESTADO_TEXT[cita.estadoTexto] ?? "text-gray-400";
                    const esActiva =
                      cita.estadoTexto === "Pendiente" || cita.estadoTexto === "Confirmada";

                    return (
                      <button
                        key={cita.id}
                        className={`absolute left-1 right-1 rounded-lg text-left transition-all cursor-pointer
                          hover:left-0.5 hover:right-0.5 hover:shadow-md active:scale-[0.99]
                          ${bg} ${esActiva ? "" : "opacity-55"}`}
                        style={{ top: top + 2, height: height - 4 }}
                        onClick={() => onCitaClick(cita)}
                        title={`${cita.nombreCliente} — ${cita.nombreServicio} (${cita.estadoTexto})`}
                      >
                        <div className={`px-2 py-1 overflow-hidden h-full flex flex-col gap-0.5 ${textCls}`}>
                          <span className="text-[10px] font-bold leading-none opacity-90">
                            {new Date(cita.inicioEn).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                          {height > 28 && (
                            <span className="text-[11px] font-semibold leading-tight truncate">
                              {cita.nombreCliente}
                            </span>
                          )}
                          {height > 48 && (
                            <span className="text-[10px] leading-tight truncate opacity-80">
                              {cita.nombreServicio}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}

              {/* Current time line */}
              {nowTop !== null && fecha === hoy && (
                <div
                  className="absolute left-14 right-0 z-10 pointer-events-none"
                  style={{ top: nowTop }}
                >
                  <div className="relative">
                    <div className="absolute -left-[3px] -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                    <div className="border-t border-red-400" />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
