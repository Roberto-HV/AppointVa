import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSectorTerms, type SectorTerms } from "../../hooks/useSectorTerms";
import { colorCategoria, TEXTO_SOBRE_CATEGORIA } from "../../lib/temaGraficas";
import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { useAuthStore } from "../../store/authStore";
import type { CitaDto } from "../../types";
import { toUtcDate } from "../../utils/formatters";
import { DatePicker } from "../ui/DateTimePicker";
import { hoy as hoyLocal } from "../../utils/fechas";
import { ESTADO_CITA, ESTADOS_CITA, estiloEstadoCita } from "../../lib/estadoCita";
import { dentroDelRango, ocupaAgenda, rangoHoras } from "../../lib/carrilesCitas";

const PX_POR_HORA = 56;
const BOTON_ICONO =
  "inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] rounded-lg " +
  "hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const COL_MIN_W = 148;



function horaLabel(h: number): string {
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function calcTop(iso: string, horaInicio: number): number {
  const d = toUtcDate(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  return Math.max(0, (h - horaInicio) * PX_POR_HORA);
}

function calcAltura(min: number): number {
  return Math.max(22, (min / 60) * PX_POR_HORA);
}


function navFecha(base: string, delta: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface Props {
  onCitaClick: (cita: CitaDto) => void;
  /** Vocabulario del sector ("consultas" en salud) (DC-34). */
  terms?: SectorTerms;
}

export default function GanttCitas({ onCitaClick, terms = getSectorTerms(null) }: Props) {
  const contar = (n: number) => `${n} ${(n === 1 ? terms.cita : terms.citas).toLowerCase()}`;
  const hoy = hoyLocal();
  const [fecha, setFecha] = useState(hoy);
  const [nowTop, setNowTop] = useState<number | null>(null);
  const usuario = useAuthStore((s) => s.usuario);
  const esEmpleado = usuario?.rol === "Empleado";

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["citas-gantt", fecha],
    queryFn: () => citasApi.obtenerTodas({ desde: fecha, hasta: fecha, tamano: 200 }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const citas = data?.datos ?? [];

  // Las horas visibles se amplían para que ninguna cita quede fuera de la rejilla.
  const { inicio: HORA_INICIO, fin: HORA_FIN } = rangoHoras(citas);
  const GRID_H = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;

  useEffect(() => {
    const calc = () => {
      const n = new Date();
      const h = n.getHours() + n.getMinutes() / 60;
      setNowTop(h >= HORA_INICIO && h <= HORA_FIN ? (h - HORA_INICIO) * PX_POR_HORA : null);
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [HORA_INICIO, HORA_FIN]);

  const {
    data: datosEmpleados, isError: errorEmpleados, refetch: reintentarEmpleados, isFetching: actualizandoEmpleados,
  } = useQuery({
    queryKey: ["empleados"],
    queryFn: () => empleadosApi.obtenerTodos(),
    staleTime: 1000 * 60 * 5,
  });
  const empleados = datosEmpleados ?? [];

  // Igual que Citas y Kiosko: un sondeo fallido no borra una jornada ya pintada.
  // Error a pantalla completa solo si todavía no hay nada que mostrar; si ya hay
  // datos se conservan y se avisa con un banner que no bloquea.
  const sinDatos = (isError && !data) || (errorEmpleados && !datosEmpleados);
  const datosDesactualizados = !sinDatos && (isError || errorEmpleados);
  const reintentando = isFetching || actualizandoEmpleados;
  const reintentar = () => {
    if (isError) refetch();
    if (errorEmpleados) reintentarEmpleados();
  };

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
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFecha(navFecha(fecha, -1))}
            className={BOTON_ICONO}
            aria-label="Día anterior"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="w-44">
            <DatePicker value={fecha} onChange={(v) => setFecha(v)} />
          </div>
          <button
            onClick={() => setFecha(navFecha(fecha, 1))}
            className={BOTON_ICONO}
            aria-label="Día siguiente"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <button
          onClick={() => setFecha(hoy)}
          disabled={fecha === hoy}
          className="min-h-[44px] lg:min-h-[36px] text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 px-3 rounded-lg transition"
        >
          Hoy
        </button>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            {isLoading ? "Cargando..." : sinDatos ? "Sin datos" : contar(citasActivas.length)}
          </span>
          <ul className="hidden sm:flex items-center gap-3" aria-label="Leyenda de estados">
            {ESTADOS_CITA.map((estado) => (
              <li key={estado} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-sm ${ESTADO_CITA[estado].punto}`} aria-hidden="true" />
                <span className="text-xs text-slate-600 dark:text-slate-300">{ESTADO_CITA[estado].etiqueta}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {datosDesactualizados && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-300">
          <span>No se pudo actualizar la jornada. Lo que ves puede no estar al día.</span>
          <button
            type="button"
            onClick={reintentar}
            disabled={reintentando}
            className="min-h-[44px] lg:min-h-[36px] px-4 rounded-lg border border-border font-medium text-foreground hover:bg-muted disabled:opacity-50 transition"
          >
            {reintentando ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          Cargando jornada...
        </div>
      ) : sinDatos ? (
        // Un fallo no debe parecer una jornada vacía.
        <div role="alert" className="h-40 flex flex-col items-center justify-center gap-3 text-sm text-red-700 dark:text-red-400">
          <span>No se pudo cargar la jornada.</span>
          <button
            type="button"
            onClick={reintentar}
            disabled={reintentando}
            className="min-h-[44px] lg:min-h-[36px] px-4 rounded-lg border border-border font-medium text-foreground hover:bg-muted disabled:opacity-50 transition"
          >
            {reintentando ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      ) : emps.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          No hay empleados activos
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: 56 + emps.length * COL_MIN_W }}>

            {/* Employee header row */}
            <div className="flex border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10">
              <div className="w-14 flex-shrink-0 border-r border-slate-100 dark:border-slate-700" />
              {emps.map((emp, i) => {
                const empCitas = (porEmp.get(emp.id) ?? []).filter(
                  (c) => c.estadoTexto !== "Cancelada" && c.estadoTexto !== "Inasistencia"
                );
                return (
                  <div
                    key={emp.id}
                    className="flex-1 flex flex-col items-center py-3 border-r border-slate-100 dark:border-slate-700 last:border-r-0"
                    style={{ minWidth: COL_MIN_W }}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mb-1.5 flex-shrink-0 ${TEXTO_SOBRE_CATEGORIA}`}
                      style={{ background: colorCategoria(i) }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[120px] px-1 leading-tight">
                      {emp.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground mt-0.5">
                      {empCitas.length > 0
                        ? contar(empCitas.length)
                        : `Sin ${terms.citas.toLowerCase()}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div className="flex relative" style={{ height: GRID_H }}>

              {/* Time labels */}
              <div className="w-14 flex-shrink-0 border-r border-slate-100 dark:border-slate-700 relative">
                {horas.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 flex justify-end pr-2"
                    style={{ top: (h - HORA_INICIO) * PX_POR_HORA - 7 }}
                  >
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">{horaLabel(h)}</span>
                  </div>
                ))}
              </div>

              {/* Horizontal grid lines */}
              <div className="absolute left-14 right-0 top-0 bottom-0 pointer-events-none">
                {horas.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-slate-100 dark:border-slate-700/50"
                    style={{ top: (h - HORA_INICIO) * PX_POR_HORA }}
                  />
                ))}
                {horas.map((h) => (
                  <div
                    key={h + 0.5}
                    className="absolute left-0 right-0 border-t border-slate-50 dark:border-slate-800"
                    style={{ top: (h - HORA_INICIO + 0.5) * PX_POR_HORA }}
                  />
                ))}
              </div>

              {/* Employee columns */}
              {emps.map((emp) => (
                <div
                  key={emp.id}
                  className="flex-1 relative border-r border-slate-100 dark:border-slate-700 last:border-r-0"
                  style={{ minWidth: COL_MIN_W }}
                >
                  {(porEmp.get(emp.id) ?? []).map((cita) => {
                    // Las canceladas e inasistencias no amplían las horas visibles;
                    // si quedan fuera de ellas no se dibujan (no ocupan la agenda).
                    if (!ocupaAgenda(cita) && !dentroDelRango(cita, { inicio: HORA_INICIO, fin: HORA_FIN })) return null;
                    const top = calcTop(cita.inicioEn, HORA_INICIO);
                    const height = calcAltura(cita.duracionMinutos);
                    // Mismo mapa que la lista y el calendario: fondo + texto del
                    // token, nunca texto blanco sobre el color del estado.
                    const estilo = estiloEstadoCita(cita.estadoTexto);
                    const cerrada = cita.estadoTexto === "Cancelada" || cita.estadoTexto === "Inasistencia";

                    return (
                      <button
                        key={cita.id}
                        type="button"
                        className={`absolute left-1 right-1 rounded-lg text-left transition-all cursor-pointer
                          hover:left-0.5 hover:right-0.5 hover:shadow-md active:scale-[0.99]
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                          ${estilo.bloque}`}
                        style={{ top: top + 2, height: height - 4 }}
                        onClick={() => onCitaClick(cita)}
                        aria-label={`${cita.nombreCliente}, ${cita.nombreServicio}, ${estilo.etiqueta}. Abrir acciones`}
                        title={`${cita.nombreCliente} — ${cita.nombreServicio} (${estilo.etiqueta})`}
                      >
                        <div className={`px-2 py-1 overflow-hidden h-full flex flex-col gap-0.5 ${cerrada ? "line-through" : ""}`}>
                          <span className="text-[10px] font-bold leading-none">
                            {toUtcDate(cita.inicioEn).toLocaleTimeString("es-MX", {
                              hour: "numeric",
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
                            <span className="text-[10px] leading-tight truncate">
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
