import { useState, useRef, useEffect, type MouseEvent as EventoRaton } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, List } from "lucide-react";
import { getSectorTerms, type SectorTerms } from "../../hooks/useSectorTerms";
import { citasApi } from "../../api/citas";
import type { CitaDto } from "../../types";
import { formatHora, formatHoraEje, toUtcDate } from "../../utils/formatters";
import { fechaLocal, deFechaLocal, hoy as hoyLocal } from "../../utils/fechas";
import { CONSULTA_MOVIL } from "../../hooks/useMediaQuery";
import { citaAbierta, estiloEstadoCita } from "../../lib/estadoCita";
import { asignarCarriles, dentroDelRango, rangoHoras, type Carril } from "../../lib/carrilesCitas";
import {
  bandasFueraDeHorario, diaCerrado, horaDeDesplazamiento, instanteEnRejilla, motivoHuecoBloqueado,
  rangoDelHorario, TEXTO_HUECO_BLOQUEADO, type MotivoHuecoBloqueado,
} from "../../lib/agenda";
import { BarraFechaAgenda, LeyendaEstados, type HuecoAgenda, type OpcionVistaAgenda } from "./BarraAgenda";
import { useHorarioAgenda } from "../../hooks/useHorarioAgenda";

const PX_POR_HORA = 64;
/** Alto del recuadro que marca el hueco bajo el puntero (30 min). */
const ALTO_HUECO = PX_POR_HORA / 2;
/**
 * En Semana, un grupo de citas encimadas muestra como mucho dos columnas y un
 * "+N" en la tercera que abre ese día: con siete días en pantalla, cuatro
 * columnas dejaban bloques de ~35px con "4:0… Cor…" (I2).
 */
const MAX_CARRILES_SEMANA = 3;

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

const VISTAS: OpcionVistaAgenda<VistaCalendario>[] = [
  { id: "semana", etiqueta: "Semana", Icono: CalendarDays },
  { id: "dia", etiqueta: "Día", Icono: List },
];

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
  /** `ancla` es el bloque tocado: en escritorio las acciones se abren junto a él. */
  onCitaClick: (cita: CitaDto, ancla?: HTMLElement) => void;
  onReagendar?: (cita: CitaDto, nuevoInicio: string) => void;
  /** Día mostrado ("YYYY-MM-DD"). Lo comparte con la Línea de tiempo. */
  fecha?: string;
  onCambiarFecha?: (fecha: string) => void;
  /** Clic en un hueco libre y dentro del horario: abre "Nueva cita" (I1). */
  onHuecoClick?: (hueco: HuecoAgenda) => void;
}

/** Hueco bajo el puntero: dónde dibujar el recuadro y si se puede agendar. */
interface HuecoSenalado {
  colIdx: number;
  inicio: Date;
  motivo: MotivoHuecoBloqueado | null;
}

export default function CalendarioCitas({
  empleadoId, onCitaClick, onReagendar, terms = getSectorTerms(null), fecha: fechaProp, onCambiarFecha, onHuecoClick,
}: Props) {
  const [vista, setVistaEstado] = useState<VistaCalendario>(vistaInicial);
  const setVista = (v: VistaCalendario) => {
    setVistaEstado(v);
    try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* almacenamiento no disponible */ }
  };
  // Controlado si la página comparte el día con la Línea de tiempo.
  const [fechaInterna, setFechaInterna] = useState(() => fechaProp ?? hoyLocal());
  const fecha = fechaProp ?? fechaInterna;
  const setFecha = (f: string) => {
    setFechaInterna(f);
    onCambiarFecha?.(f);
  };
  const diaActivo = deFechaLocal(fecha);
  const lunes = getLunesDeEstaSemana(diaActivo);

  const [arrastrando, setArrastrando] = useState<CitaDto | null>(null);
  const [dropTarget, setDropTarget] = useState<{ colIdx: number; hora: number; minutos: number } | null>(null);
  const [hueco, setHueco] = useState<HuecoSenalado | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { horarios, bloqueados, horarioCargado } = useHorarioAgenda();

  const domingo = addDias(lunes, 6);
  const hastaApi = addDias(domingo, 1);

  const { data: citas = [], isError, refetch, isFetching, isSuccess } = useQuery({
    queryKey: ["citas-cal", lunes.toISOString(), empleadoId],
    queryFn: () => citasApi.obtenerTodas({
      desde: fechaLocal(lunes),
      hasta: fechaLocal(hastaApi),
      empleadoId: empleadoId || undefined,
    }),
    select: (p) => p.datos,
  });

  // Las horas visibles son las del horario del negocio, ampliadas para que
  // ninguna cita quede recortada.
  const { inicio: HORA_INICIO, fin: HORA_FIN } = rangoHoras(citas, rangoDelHorario(horarios));
  const GRID_HEIGHT = (HORA_FIN - HORA_INICIO) * PX_POR_HORA;
  const dias = Array.from({ length: 7 }, (_, i) => addDias(lunes, i));
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const hoy = new Date();

  const abrirDia = (dia: Date) => {
    setFecha(fechaLocal(dia));
    setVista("dia");
  };

  function citasDelDia(dia: Date): CitaDto[] {
    const dStr = dia.toDateString();
    return citas.filter((c) => new Date(c.inicioEn).toDateString() === dStr);
  }

  // Al abrir (y al cambiar de semana, día o vista) la rejilla se desplaza a la
  // hora actual, o a la apertura del primer día abierto: antes abría siempre a
  // las 7 a. m. aunque las citas del día fueran por la tarde (I2).
  const diasVisibles = vista === "semana" ? dias : [diaActivo];
  const claveDesplazamiento = `${vista}|${vista === "semana" ? fechaLocal(lunes) : fecha}`;
  const desplazadoPara = useRef<string | null>(null);
  // Con citas y horario ya cargados: el horario mueve la primera hora de la
  // rejilla, y desplazar antes dejaba la vista corrida dos horas.
  const listoParaDesplazar = (isSuccess || isError) && horarioCargado;
  useEffect(() => {
    if (!listoParaDesplazar || desplazadoPara.current === claveDesplazamiento || !scrollRef.current) return;
    desplazadoPara.current = claveDesplazamiento;
    const primera = diasVisibles.flatMap(citasDelDia)
      .map((c) => toUtcDate(c.inicioEn))
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const hora = horaDeDesplazamiento(diasVisibles, horarios, bloqueados, primera);
    scrollRef.current.scrollTop = hora === null ? 0 : Math.max(0, (hora - HORA_INICIO) * PX_POR_HORA);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por rango mostrado, cuando ya hay datos
  }, [claveDesplazamiento, listoParaDesplazar, HORA_INICIO]);

  function calcTop(cita: CitaDto): number {
    const d = toUtcDate(cita.inicioEn);
    return Math.max(0, (d.getHours() + d.getMinutes() / 60 - HORA_INICIO) * PX_POR_HORA);
  }

  function calcAltura(cita: CitaDto): number {
    return Math.max(22, (cita.duracionMinutos / 60) * PX_POR_HORA);
  }

  const semanaLabel = `${lunes.getDate()} ${MESES[lunes.getMonth()]} — ${domingo.getDate()} ${MESES[domingo.getMonth()]} ${domingo.getFullYear()}`;
  const diaActivoLabel = `${DIAS_CORTOS[diaActivo.getDay()]}, ${diaActivo.getDate()} de ${MESES[diaActivo.getMonth()]} ${diaActivo.getFullYear()}`;

  const horaActual = hoy.getHours() + hoy.getMinutes() / 60;
  const horaActualTop = (horaActual - HORA_INICIO) * PX_POR_HORA;

  const badgeOcupacion = (count: number) => {
    if (count === 0) return null;
    const color = count >= 7 ? "text-red-500" : count >= 4 ? "text-amber-500" : "text-emerald-600";
    return <span className={`text-[10px] font-semibold mt-0.5 ${color}`}>{count}</span>;
  };

  // ── Huecos (I1) ──────────────────────────────────────────────────────────────
  const huecoBajo = (e: EventoRaton<HTMLDivElement>, dia: Date, colIdx: number): HuecoSenalado => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const inicio = instanteEnRejilla(dia, y, HORA_INICIO, PX_POR_HORA);
    return { colIdx, inicio, motivo: motivoHuecoBloqueado(inicio, horarios, bloqueados) };
  };
  const sobreCita = (e: EventoRaton) => !!(e.target as HTMLElement).closest("[data-cita]");

  const propsHueco = (dia: Date, colIdx: number) => onHuecoClick ? {
    onMouseMove: (e: EventoRaton<HTMLDivElement>) => {
      if (arrastrando || sobreCita(e)) { if (hueco) setHueco(null); return; }
      const h = huecoBajo(e, dia, colIdx);
      if (!hueco || hueco.colIdx !== colIdx || hueco.inicio.getTime() !== h.inicio.getTime()) setHueco(h);
    },
    onMouseLeave: () => setHueco(null),
    onClick: (e: EventoRaton<HTMLDivElement>) => {
      if (arrastrando || sobreCita(e)) return;
      const h = huecoBajo(e, dia, colIdx);
      // Un hueco pasado, de un día cerrado o fuera del horario no abre nada:
      // el recuadro ya dice por qué.
      if (h.motivo) return;
      setHueco(null);
      onHuecoClick({ inicio: h.inicio, empleadoId: empleadoId || undefined });
    },
  } : {};

  const renderHueco = (colIdx: number) => {
    if (!hueco || hueco.colIdx !== colIdx || arrastrando) return null;
    const top = ((hueco.inicio.getHours() + hueco.inicio.getMinutes() / 60) - HORA_INICIO) * PX_POR_HORA;
    const bloqueado = !!hueco.motivo;
    return (
      <div
        aria-hidden="true"
        className={`absolute inset-x-0.5 z-[5] pointer-events-none rounded px-1.5 text-[11px] font-medium leading-tight flex items-start pt-0.5 ${
          bloqueado
            ? "bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400"
            : "border border-dashed border-slate-400 dark:border-slate-500 bg-slate-50/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200"
        }`}
        style={{ top, height: ALTO_HUECO }}
      >
        {bloqueado ? TEXTO_HUECO_BLOQUEADO[hueco.motivo!] : `+ ${formatHora(hueco.inicio.toISOString())}`}
      </div>
    );
  };

  // Fuera del horario y días cerrados se sombrean: el hueco no se ofrece.
  const renderFueraDeHorario = (dia: Date) =>
    bandasFueraDeHorario(dia, horarios, bloqueados, { inicio: HORA_INICIO, fin: HORA_FIN }).map(([a, b]) => (
      <div
        key={`${a}-${b}`}
        aria-hidden="true"
        className="absolute inset-x-0 pointer-events-none bg-slate-100/80 dark:bg-slate-800/60"
        style={{ top: (a - HORA_INICIO) * PX_POR_HORA, height: (b - a) * PX_POR_HORA }}
      />
    ));

  // ── Citas ────────────────────────────────────────────────────────────────────
  // Citas que se solapan se dibujan lado a lado y cada una se estira sobre las
  // columnas vecinas libres. Las canceladas e inasistencias no ocupan columna:
  // van detrás (z-0) a todo el ancho y atenuadas; si caen fuera de las horas
  // visibles no se dibujan.
  const renderGridCita = (c: CitaDto, carriles: Map<string, Carril>, compacto: boolean) => {
    const info = carriles.get(c.id) ?? { carril: 0, carriles: 1 };
    const { carril, deFondo } = info;
    if (deFondo && !dentroDelRango(c, { inicio: HORA_INICIO, fin: HORA_FIN })) return null;
    // En Semana, un grupo con más columnas de las que caben deja las dos
    // primeras y agrupa el resto en el "+N" de `renderMasCitas`.
    const excede = compacto && info.carriles > MAX_CARRILES_SEMANA;
    const totalCols = excede ? MAX_CARRILES_SEMANA : info.carriles;
    const visibles = excede ? MAX_CARRILES_SEMANA - 1 : totalCols;
    if (carril >= visibles) return null;
    const ancho = Math.min(info.ancho ?? 1, visibles - carril);
    const top = calcTop(c);
    const height = calcAltura(c);
    const estilo = estiloEstadoCita(c.estadoTexto);
    const hora = formatHora(c.inicioEn);
    const puedeMover = onReagendar && citaAbierta(c.estadoTexto);
    // Angosto: hora y nombre en líneas separadas, sin servicio, en vez de
    // "4:0… Cor…" en una sola línea.
    const angosto = compacto && totalCols / ancho > 1;
    return (
      <button
        key={c.id}
        type="button"
        data-cita=""
        onClick={(e) => !arrastrando && onCitaClick(c, e.currentTarget)}
        aria-label={`${hora} ${c.nombreCliente}, ${c.nombreServicio}, ${estilo.etiqueta}. Abrir acciones`}
        aria-haspopup="dialog"
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
          width: `calc(${(ancho / totalCols) * 100}% - 4px)`,
        }}
      >
        {angosto ? (
          <>
            <p className="font-semibold leading-tight text-[11px] whitespace-nowrap">{hora}</p>
            {height > 30 && <p className="truncate leading-tight">{c.nombreCliente.split(" ")[0]}</p>}
          </>
        ) : (
          <>
            <p className="font-semibold truncate leading-tight">{hora} {c.nombreCliente}</p>
            {height > 30 && <p className="truncate leading-tight">{c.nombreServicio}</p>}
            {totalCols === 1 && height > 52 && (
              <p className="truncate leading-tight">{c.duracionMinutos} min · {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(c.precio)}</p>
            )}
          </>
        )}
      </button>
    );
  };

  /**
   * "+N" en la tercera columna de Semana para las citas que no caben. Se agrupan
   * las ocultas que se tocan en el tiempo; el botón abre el día.
   */
  const renderMasCitas = (dia: Date, citasDia: CitaDto[], carriles: Map<string, Carril>) => {
    const ocultas = citasDia
      .filter((c) => {
        const info = carriles.get(c.id);
        return info && !info.deFondo && info.carriles > MAX_CARRILES_SEMANA && info.carril >= MAX_CARRILES_SEMANA - 1;
      })
      .map((c) => ({ ini: toUtcDate(c.inicioEn).getTime(), fin: toUtcDate(c.inicioEn).getTime() + c.duracionMinutos * 60_000 }))
      .sort((a, b) => a.ini - b.ini);
    const grupos: { ini: number; fin: number; n: number }[] = [];
    for (const o of ocultas) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && o.ini < ultimo.fin) { ultimo.fin = Math.max(ultimo.fin, o.fin); ultimo.n++; }
      else grupos.push({ ...o, n: 1 });
    }
    return grupos.map((g) => {
      const ini = new Date(g.ini);
      const top = Math.max(0, (ini.getHours() + ini.getMinutes() / 60 - HORA_INICIO) * PX_POR_HORA);
      const height = Math.max(22, ((g.fin - g.ini) / 3_600_000) * PX_POR_HORA);
      const n = g.n;
      return (
        <button
          key={g.ini}
          type="button"
          data-cita=""
          onClick={() => abrirDia(dia)}
          aria-label={`${n} ${(n === 1 ? terms.cita : terms.citas).toLowerCase()} más desde las ${formatHora(ini.toISOString())}. Ver el día`}
          className="absolute z-10 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            top, height,
            left: `calc(${((MAX_CARRILES_SEMANA - 1) / MAX_CARRILES_SEMANA) * 100}% + 2px)`,
            width: `calc(${100 / MAX_CARRILES_SEMANA}% - 4px)`,
          }}
        >
          +{n}
        </button>
      );
    });
  };

  const renderLineaAhora = (dia: Date) =>
    dia.toDateString() === hoy.toDateString() && horaActualTop > 0 && horaActualTop < GRID_HEIGHT && (
      <div className="absolute w-full z-20 pointer-events-none" style={{ top: horaActualTop }}>
        <div className="relative">
          <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
          <div className="border-t-2 border-red-400 w-full" />
        </div>
      </div>
    );

  const renderColumnaHoras = () => (
    <div className="w-14 shrink-0 relative bg-white dark:bg-slate-900" style={{ height: GRID_HEIGHT }}>
      {horas.map((h) => (
        <div key={h} className="absolute w-full pr-1.5" style={{ top: h === HORA_INICIO ? 2 : (h - HORA_INICIO) * PX_POR_HORA - 8 }}>
          <span className="text-xs text-slate-400 dark:text-slate-600 float-right whitespace-nowrap tabular-nums">{formatHoraEje(h)}</span>
        </div>
      ))}
    </div>
  );

  const renderColumnaDia = (dia: Date, colIdx: number, compacto: boolean) => {
    const citasDia = citasDelDia(dia);
    const carriles = asignarCarriles(citasDia);
    const esDropTarget = dropTarget?.colIdx === colIdx;
    return (
      <div
        key={colIdx}
        data-testid={`columna-${fechaLocal(dia)}`}
        className={`flex-1 min-w-0 relative border-l border-slate-100 dark:border-slate-700/50 ${onHuecoClick ? "cursor-pointer" : ""} ${arrastrando && esDropTarget ? "bg-slate-700/5 dark:bg-slate-600/10" : ""}`}
        style={{ height: GRID_HEIGHT }}
        {...propsHueco(dia, colIdx)}
        onDragOver={(e) => {
          if (!arrastrando) return;
          e.preventDefault();
          const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
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
        {renderFueraDeHorario(dia)}
        {horas.map((h) => (
          <div key={h} className="absolute w-full border-t border-slate-100 dark:border-slate-700/50 pointer-events-none" style={{ top: (h - HORA_INICIO) * PX_POR_HORA }} />
        ))}
        {renderLineaAhora(dia)}
        {esDropTarget && dropTarget && arrastrando && (
          <div
            className="absolute inset-x-0.5 h-1 bg-slate-700/60 rounded z-30 pointer-events-none"
            style={{ top: (dropTarget.hora - HORA_INICIO + dropTarget.minutos / 60) * PX_POR_HORA }}
          />
        )}
        {renderHueco(colIdx)}
        {citasDia.map((c) => renderGridCita(c, carriles, compacto))}
        {compacto && renderMasCitas(dia, citasDia, carriles)}
      </div>
    );
  };

  const cerradoTexto = (dia: Date) =>
    diaCerrado(dia, horarios, bloqueados) && (
      <span className="text-[10px] font-semibold text-red-700 dark:text-red-400">Cerrado</span>
    );

  return (
    <div>
      <BarraFechaAgenda
        etiqueta={vista === "semana" ? semanaLabel : diaActivoLabel}
        etiquetaAnterior={vista === "semana" ? "Semana anterior" : "Día anterior"}
        etiquetaSiguiente={vista === "semana" ? "Semana siguiente" : "Día siguiente"}
        onAnterior={() => setFecha(fechaLocal(addDias(diaActivo, vista === "semana" ? -7 : -1)))}
        onSiguiente={() => setFecha(fechaLocal(addDias(diaActivo, vista === "semana" ? 7 : 1)))}
        onHoy={() => setFecha(hoyLocal())}
        fecha={fecha}
        onElegirFecha={setFecha}
        vistas={VISTAS}
        vista={vista}
        onCambiarVista={setVista}
      />

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

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <LeyendaEstados />
        {onHuecoClick && (
          <p className="text-xs text-muted-foreground hidden lg:block">
            {`Haz clic en un hueco libre para agendar una ${terms.cita.toLowerCase()}.`}
          </p>
        )}
      </div>

      {/* ── Vista Semana ── */}
      {vista === "semana" && (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 620 }}>
        {/* Cabecera días */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-30">
          <div className="w-14 shrink-0" />
          {dias.map((dia, i) => {
            const esHoy = dia.toDateString() === hoy.toDateString();
            const count = citasDelDia(dia).length;
            return (
              <button
                key={i}
                type="button"
                onClick={() => abrirDia(dia)}
                aria-label={`Ver ${DIAS_CORTOS[dia.getDay()]} ${dia.getDate()} de ${MESES[dia.getMonth()]}`}
                className="flex-1 min-w-0 py-2 text-center border-l border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex flex-col items-center"
              >
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">{DIAS_CORTOS[dia.getDay()]}</p>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${esHoy ? "bg-slate-700 dark:bg-slate-500" : ""}`}>
                  <span className={`text-sm font-semibold ${esHoy ? "text-white" : "text-slate-700 dark:text-slate-300"}`}>{dia.getDate()}</span>
                </div>
                {badgeOcupacion(count)}
                {cerradoTexto(dia)}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex">
          {renderColumnaHoras()}
          {dias.map((dia, colIdx) => renderColumnaDia(dia, colIdx, true))}
        </div>
        </div>
      </div>
      )}

      {/* ── Vista Día ── */}
      {vista === "dia" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="w-14 shrink-0" />
            <div className="flex-1 py-3 text-center border-l border-slate-100 dark:border-slate-700 flex flex-col items-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {diaActivoLabel}
              </p>
              {(() => {
                const n = citasDelDia(diaActivo).length;
                return <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{n} {(n === 1 ? terms.cita : terms.citas).toLowerCase()}</p>;
              })()}
              {cerradoTexto(diaActivo)}
            </div>
          </div>

          <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: 640 }}>
            {renderColumnaHoras()}
            {renderColumnaDia(diaActivo, 0, false)}
          </div>
        </div>
      )}
    </div>
  );
}
