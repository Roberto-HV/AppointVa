import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { getSectorTerms, type SectorTerms } from "../../hooks/useSectorTerms";
import { citasApi } from "../../api/citas";
import type { CitaDto } from "../../types";
import { toUtcDate } from "../../utils/formatters";
import { fechaLocal } from "../../utils/fechas";
import { CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { ESTADO_CITA, ESTADOS_CITA, citaAbierta, estiloEstadoCita } from "../../lib/estadoCita";
import { asignarCarriles, dentroDelRango, rangoHoras, type Carril } from "../../lib/carrilesCitas";

const PX_POR_HORA = 64;

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// En minúscula: en español los meses no llevan mayúscula ("21 de oct 2026").
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];


function getLunesDeEstaSemana(date: Date): Date {
  const d = new Date(date);
  const dia = d.getDay();
  d.setDate(d.getDate() - dia + (dia === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDias(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

type VistaCalendario = "semana" | "dia";
const CLAVE_VISTA = "calendario-vista";

/**
 * La elección se recuerda por dispositivo. Sin elección previa, el teléfono abre
 * en "día": siete columnas a 375px dejaban ~46px por día con bloques ilegibles.
 */
function vistaInicial(): VistaCalendario {
  try {
    const guardada = localStorage.getItem(CLAVE_VISTA);
    if (guardada === "semana" || guardada === "dia") return guardada;
  } catch { /* almacenamiento no disponible */ }
  const movil = typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia(CONSULTA_MOVIL).matches;
  return movil ? "dia" : "semana";
}

interface Props {
  empleadoId: string;
  /** Vocabulario del sector ("consultas" en salud) (DC-34). */
  terms?: SectorTerms;
  onCitaClick: (cita: CitaDto) => void;
  onReagendar?: (cita: CitaDto, nuevoInicio: string) => void;
}

export default function CalendarioCitas({ empleadoId, onCitaClick, onReagendar, terms = getSectorTerms(null) }: Props) {
  const [vista, setVistaEstado] = useState<VistaCalendario>(vistaInicial);
  const setVista = (v: VistaCalendario) => {
    setVistaEstado(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* almacenamiento no disponible */ }
  };
  const [lunes, setLunes] = useState(() => getLunesDeEstaSemana(new Date()));
  const [diaActivo, setDiaActivo] = useState(() => new Date());
  const [arrastrando, setArrastrando] = useState<CitaDto | null>(null);
  const [dropTarget, setDropTarget] = useState<{ colIdx: number; hora: number; minutos: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);
  const domingo = addDias(lunes, 6);
  const hastaApi = addDias(domingo, 1);

  const { data: citas = [], isError, refetch, isFetching } = useQuery({
    queryKey: ["citas-cal", lunes.toISOString(), empleadoId],
    queryFn: () => citasApi.obtenerTodas({
      desde: fechaLocal(lunes),
      hasta: fechaLocal(hastaApi),
      empleadoId: empleadoId || undefined,
    }),
    select: (p) => p.datos,
  });

  // Las horas visibles se amplían para que ninguna cita quede recortada.
  const { inicio: HORA_INICIO, fin: HORA_FIN } = rangoHoras(citas);
  const GRID_HEIGHT = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;
  const dias = Array.from({ length: 7 }, (_, i) => addDias(lunes, i));
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const hoy = new Date();

  const abrirDia = (dia: Date) => {
    setDiaActivo(dia);
    setVista("dia");
    const lunesDia = getLunesDeEstaSemana(dia);
    if (lunesDia.toDateString() !== lunes.toDateString()) setLunes(lunesDia);
  };

  function calcTop(cita: CitaDto): number {
    const d = toUtcDate(cita.inicioEn);
    return Math.max(0, (d.getHours() + d.getMinutes() / 60 - HORA_INICIO) * PX_POR_HORA);
  }

  function calcAltura(cita: CitaDto): number {
    return Math.max(22, (cita.duracionMinutos / 60) * PX_POR_HORA);
  }

  function citasDelDia(dia: Date): CitaDto[] {
    const dStr = dia.toDateString();
    return citas.filter((c) => new Date(c.inicioEn).toDateString() === dStr);
  }

  const semanaLabel = `${lunes.getDate()} ${MESES[lunes.getMonth()]} — ${domingo.getDate()} ${MESES[domingo.getMonth()]} ${domingo.getFullYear()}`;
  const diaActivoLabel = `${DIAS_CORTOS[diaActivo.getDay()]}, ${diaActivo.getDate()} de ${MESES[diaActivo.getMonth()]} ${diaActivo.getFullYear()}`;

  const horaActual = hoy.getHours() + hoy.getMinutes() / 60;
  const horaActualTop = (horaActual - HORA_INICIO) * PX_POR_HORA;
  const hoyEnSemana = dias.some((d) => d.toDateString() === hoy.toDateString());
  const indiceDiaHoy = dias.findIndex((d) => d.toDateString() === hoy.toDateString());

  const badgeOcupacion = (count: number) => {
    if (count === 0) return null;
    const color = count >= 7 ? "text-red-500" : count >= 4 ? "text-amber-500" : "text-emerald-600";
    return <span className={`text-[10px] font-semibold mt-0.5 ${color}`}>{count}</span>;
  };

  const NAV_BTN = "flex items-center justify-center gap-1.5 px-3 min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition w-fit";

  // Citas que se solapan se dibujan lado a lado; cada una se puede tocar.
  // Las canceladas e inasistencias no ocupan carril: van detrás (z-0) a todo el
  // ancho y atenuadas; si caen fuera de las horas visibles no se dibujan.
  const renderGridCita = (c: CitaDto, carriles: Map<string, Carril>) => {
    const { carril, carriles: totalCols, deFondo } = carriles.get(c.id) ?? { carril: 0, carriles: 1 };
    if (deFondo && !dentroDelRango(c, { inicio: HORA_INICIO, fin: HORA_FIN })) return null;
    const top = calcTop(c);
    const height = calcAltura(c);
    const estilo = estiloEstadoCita(c.estadoTexto);
    const hora = new Date(c.inicioEn).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true });
    const puedeMover = onReagendar && citaAbierta(c.estadoTexto);
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => !arrastrando && onCitaClick(c)}
        aria-label={`${hora} ${c.nombreCliente}, ${c.nombreServicio}, ${estilo.etiqueta}. Abrir acciones`}
        title={puedeMover
          ? `Arrastra para reagendar · ${c.nombreCliente} — ${c.nombreServicio} (${hora})`
          : `${c.nombreCliente} — ${c.nombreServicio} (${hora})`}
        draggable={!!puedeMover}
        onDragStart={() => puedeMover && setArrastrando(c)}
        onDragEnd={() => { setArrastrando(null); setDropTarget(null); }}
        className={`absolute rounded text-left px-1.5 py-0.5 text-xs overflow-hidden transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          ${puedeMover ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}
          ${arrastrando?.id === c.id ? "opacity-40" : "hover:brightness-95"}
          ${deFondo ? "z-0 opacity-60 hover:opacity-100 focus-visible:opacity-100" : "z-10"}
          ${estilo.bloque}`}
        style={{
          top,
          height,
          left: `calc(${(carril / totalCols) * 100}% + 2px)`,
          width: `calc(${100 / totalCols}% - 4px)`,
        }}
      >
        <p className="font-semibold truncate leading-tight">{hora} {c.nombreCliente}</p>
        {height > 30 && <p className="truncate leading-tight">{c.nombreServicio}</p>}
        {totalCols === 1 && height > 52 && (
          <p className="truncate leading-tight">{c.duracionMinutos} min · {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c.precio)}</p>
        )}
      </button>
    );
  };

  return (
    <div>
      {/* Barra superior: navegación + toggle vista */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        {vista === "semana" ? (
          <div className="grid grid-cols-3 items-center gap-2 flex-1">
            <button onClick={() => setLunes((d) => addDias(d, -7))} className={NAV_BTN} aria-label="Semana anterior">
              <ChevronLeft size={15} />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">{semanaLabel}</span>
              <button onClick={() => setLunes(getLunesDeEstaSemana(new Date()))} className="min-h-[44px] lg:min-h-[28px] px-3 text-xs text-slate-700 dark:text-slate-300 hover:underline font-medium">Hoy</button>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setLunes((d) => addDias(d, 7))} className={NAV_BTN} aria-label="Semana siguiente">
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 items-center gap-2 flex-1">
            <button
              onClick={() => { setDiaActivo((d) => { const nd = addDias(d, -1); abrirDia(nd); return nd; }); }}
              className={NAV_BTN}
              aria-label="Día anterior"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">{diaActivoLabel}</span>
              <button onClick={() => abrirDia(new Date())} className="min-h-[44px] lg:min-h-[28px] px-3 text-xs text-slate-700 dark:text-slate-300 hover:underline font-medium">Hoy</button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setDiaActivo((d) => { const nd = addDias(d, 1); abrirDia(nd); return nd; }); }}
                className={NAV_BTN}
                aria-label="Día siguiente"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Toggle semana/día */}
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5 shrink-0" role="group" aria-label="Vista del calendario">
          <button
            onClick={() => setVista("semana")}
            aria-pressed={vista === "semana"}
            aria-label="Vista semana"
            className={`flex items-center justify-center gap-1 px-2.5 min-h-[44px] min-w-[44px] lg:min-h-[32px] lg:min-w-0 text-xs font-medium rounded-md transition ${
              vista === "semana"
                ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <CalendarDays size={13} />
            <span className="hidden sm:inline">Semana</span>
          </button>
          <button
            onClick={() => { setDiaActivo(hoy); setVista("dia"); }}
            aria-pressed={vista === "dia"}
            aria-label="Vista día"
            className={`flex items-center justify-center gap-1 px-2.5 min-h-[44px] min-w-[44px] lg:min-h-[32px] lg:min-w-0 text-xs font-medium rounded-md transition ${
              vista === "dia"
                ? "bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <List size={13} />
            <span className="hidden sm:inline">Día</span>
          </button>
        </div>
      </div>

      {isError && (
        <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm text-red-800 dark:text-red-300">
          <span>No se pudo cargar el calendario. Un día vacío puede no estarlo.</span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="min-h-[44px] lg:min-h-[36px] px-4 rounded-lg border border-red-300 dark:border-red-800 font-medium hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition"
          >
            {isFetching ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      )}

      {/* Leyenda estados: los mismos colores e iconos que la lista y el Gantt */}
      <ul className="flex gap-2 flex-wrap mb-3 text-xs" aria-label="Leyenda de estados">
        {ESTADOS_CITA.map((estado) => {
          const { bloque, etiqueta, Icono } = ESTADO_CITA[estado];
          return (
            <li key={estado} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${bloque}`}>
              <Icono size={12} aria-hidden="true" /> {etiqueta}
            </li>
          );
        })}
      </ul>

      {/* ── Vista Semana ── */}
      {vista === "semana" && (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 620 }}>
        {/* Cabecera días */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="w-12 shrink-0" />
          {dias.map((dia, i) => {
            const esHoy = dia.toDateString() === hoy.toDateString();
            const count = citasDelDia(dia).length;
            return (
              <button
                key={i}
                onClick={() => abrirDia(dia)}
                className="flex-1 py-2 text-center border-l border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex flex-col items-center"
              >
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">{DIAS_CORTOS[dia.getDay()]}</p>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${esHoy ? "bg-slate-700 dark:bg-slate-500" : ""}`}>
                  <span className={`text-sm font-semibold ${esHoy ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>{dia.getDate()}</span>
                </div>
                {badgeOcupacion(count)}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex">
          {/* Columna de horas */}
          <div className="w-12 shrink-0 relative bg-white dark:bg-slate-900" style={{ height: GRID_HEIGHT }}>
            {horas.map((h) => (
              <div key={h} className="absolute w-full pr-1.5" style={{ top: h === HORA_INICIO ? 2 : (h - HORA_INICIO) * PX_POR_HORA - 8 }}>
                <span className="text-xs text-slate-400 dark:text-slate-600 float-right">{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>
              </div>
            ))}
          </div>

          {/* Columnas de días */}
          {dias.map((dia, colIdx) => {
            const citasDia = citasDelDia(dia);
            const esDropTarget = dropTarget?.colIdx === colIdx;
            return (
              <div
                key={colIdx}
                className={`flex-1 relative border-l border-slate-100 dark:border-slate-700/50 ${arrastrando && esDropTarget ? "bg-slate-700/5 dark:bg-slate-600/10" : ""}`}
                style={{ height: GRID_HEIGHT }}
                onDragOver={(e) => {
                  if (!arrastrando) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const scrollTop = scrollRef.current?.scrollTop ?? 0;
                  const y = e.clientY - rect.top + scrollTop;
                  const totalMin = Math.round((y / PX_POR_HORA) * 60 / 15) * 15;
                  const hora = Math.min(23, Math.max(HORA_INICIO, Math.floor(totalMin / 60) + HORA_INICIO));
                  setDropTarget({ colIdx, hora, minutos: totalMin % 60 });
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!arrastrando || !dropTarget || dropTarget.colIdx !== colIdx) return;
                  const nuevaFecha = new Date(dia);
                  nuevaFecha.setHours(dropTarget.hora, dropTarget.minutos, 0, 0);
                  onReagendar?.(arrastrando, nuevaFecha.toISOString());
                  setArrastrando(null);
                  setDropTarget(null);
                }}
              >
                {horas.map((h) => (
                  <div key={h} className="absolute w-full border-t border-slate-100 dark:border-slate-700/50" style={{ top: (h - HORA_INICIO) * PX_POR_HORA }} />
                ))}
                {hoyEnSemana && indiceDiaHoy === colIdx && horaActualTop > 0 && horaActualTop < GRID_HEIGHT && (
                  <div className="absolute w-full z-20 pointer-events-none" style={{ top: horaActualTop }}>
                    <div className="relative">
                      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                      <div className="border-t-2 border-red-400 w-full" />
                    </div>
                  </div>
                )}
                {esDropTarget && dropTarget && arrastrando && (
                  <div
                    className="absolute inset-x-0.5 h-1 bg-slate-700/60 rounded z-30 pointer-events-none"
                    style={{ top: (dropTarget.hora - HORA_INICIO + dropTarget.minutos / 60) * PX_POR_HORA }}
                  />
                )}
                {(() => {
                  const carriles = asignarCarriles(citasDia);
                  return citasDia.map((c) => renderGridCita(c, carriles));
                })()}
              </div>
            );
          })}
        </div>
        </div>
      </div>
      )}

      {/* ── Vista Día ── */}
      {vista === "dia" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="flex border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
            <div className="w-12 shrink-0" />
            <div className="flex-1 py-3 text-center border-l border-slate-100 dark:border-slate-700">
              <p className={`text-sm font-semibold ${diaActivo.toDateString() === hoy.toDateString() ? "text-slate-700 dark:text-slate-300" : "text-slate-800 dark:text-slate-200"}`}>
                {diaActivoLabel}
              </p>
              {(() => {
                const n = citasDelDia(diaActivo).length;
                return <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{n} {(n === 1 ? terms.cita : terms.citas).toLowerCase()}</p>;
              })()}
            </div>
          </div>

          <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: 640 }}>
            <div className="w-12 shrink-0 relative bg-white dark:bg-slate-900" style={{ height: GRID_HEIGHT }}>
              {horas.map((h) => (
                <div key={h} className="absolute w-full pr-1.5" style={{ top: (h - HORA_INICIO) * PX_POR_HORA - 8 }}>
                  <span className="text-xs text-slate-400 dark:text-slate-600 float-right">{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative border-l border-slate-100 dark:border-slate-700/50" style={{ height: GRID_HEIGHT }}>
              {horas.map((h) => (
                <div key={h} className="absolute w-full border-t border-slate-100 dark:border-slate-700/50" style={{ top: (h - HORA_INICIO) * PX_POR_HORA }} />
              ))}
              {diaActivo.toDateString() === hoy.toDateString() && horaActualTop > 0 && horaActualTop < GRID_HEIGHT && (
                <div className="absolute w-full z-20 pointer-events-none" style={{ top: horaActualTop }}>
                  <div className="relative">
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
                    <div className="border-t-2 border-red-400 w-full" />
                  </div>
                </div>
              )}
              {(() => {
                const citasDia = citasDelDia(diaActivo);
                const carriles = asignarCarriles(citasDia);
                return citasDia.map((c) => renderGridCita(c, carriles));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
