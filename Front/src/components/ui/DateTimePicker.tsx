import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";

const DIAS  = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Slots de 30 en 30, de 00:00 a 23:30
export const HORAS: string[] = [];
for (let h = 0; h < 24; h++) {
  HORAS.push(`${String(h).padStart(2,"0")}:00`);
  HORAS.push(`${String(h).padStart(2,"0")}:30`);
}

function displayHora(h: string) {
  const [hh, mm] = h.split(":");
  const n    = parseInt(hh);
  const ampm = n < 12 ? "a.m." : "p.m.";
  const n12  = n === 0 ? 12 : n > 12 ? n - 12 : n;
  return `${n12}:${mm} ${ampm}`;
}

// ─── Popover anclado ──────────────────────────────────────────────────────────

const MARGEN_VIEWPORT = 8;

interface PopoverAncladoProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Ancho deseado en px; se recorta si no cabe en la pantalla. */
  ancho: number;
  className?: string;
  ariaLabel: string;
  children: React.ReactNode;
}

/**
 * Panel flotante en un portal a `document.body` con coordenadas `fixed`
 * calculadas y sujetas al viewport.
 *
 * Un panel `absolute` dentro del contenedor del trigger se recortaba: las
 * páginas del dashboard tienen `overflow-x-hidden`, así que la parte del
 * calendario que se salía por la derecha quedaba inalcanzable en móvil en lugar
 * de poder desplazarse. El portal saca el panel de ese contenedor y el clamp
 * garantiza que siempre quede completo en pantalla.
 */
function PopoverAnclado({ anchorRef, onClose, ancho, className = "", ariaLabel, children }: PopoverAncladoProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const recalcular = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    const width = Math.min(ancho, vw - MARGEN_VIEWPORT * 2);
    // Alineado al borde izquierdo del trigger, pero nunca fuera de la pantalla.
    const left = Math.max(MARGEN_VIEWPORT, Math.min(r.left, vw - width - MARGEN_VIEWPORT));

    const alto = panelRef.current?.offsetHeight ?? 0;
    const abajo = r.bottom + MARGEN_VIEWPORT;
    const arriba = r.top - MARGEN_VIEWPORT - alto;
    const top = abajo + alto <= vh || arriba < MARGEN_VIEWPORT
      ? Math.max(MARGEN_VIEWPORT, Math.min(abajo, vh - alto - MARGEN_VIEWPORT))
      : arriba;

    setPos((prev) =>
      prev && prev.top === top && prev.left === left && prev.width === width
        ? prev
        : { top, left, width }
    );
  }, [anchorRef, ancho]);

  // Sin deps: la primera pasada mide con alto 0 y la segunda ya con el panel
  // renderizado; converge porque `setPos` conserva el objeto si no cambió.
  useLayoutEffect(recalcular);

  useEffect(() => {
    // `true` para capturar también el scroll de contenedores internos.
    window.addEventListener("scroll", recalcular, true);
    window.addEventListener("resize", recalcular);
    return () => {
      window.removeEventListener("scroll", recalcular, true);
      window.removeEventListener("resize", recalcular);
    };
  }, [recalcular]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      // El trigger gestiona su propio toggle; ignorarlo evita reabrir al instante.
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width,
        visibility: pos ? "visible" : "hidden",
      }}
      className={`z-[300] ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;           // "YYYY-MM-DD" o ""
  onChange: (v: string) => void;
  label?: string;
  minDate?: string;        // "YYYY-MM-DD"
  error?: string;
  /** Nombre accesible cuando no se muestra `label` (p. ej. "Desde"). */
  ariaLabel?: string;
}

export function DatePicker({ value, onChange, label, minDate, error, ariaLabel }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const initMes = () => {
    const d = value ? new Date(value + "T12:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  const [mes, setMes] = useState<Date>(initMes);

  useEffect(() => {
    if (value) {
      const d = new Date(value + "T12:00");
      setMes(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  const minD = minDate ? new Date(minDate + "T00:00") : null;

  // Grilla con días de meses adyacentes
  type Cell = { day: number; type: "prev" | "current" | "next" };
  const primerDia     = mes.getDay();
  const diasEnMes     = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const diasMesAnterior = new Date(mes.getFullYear(), mes.getMonth(), 0).getDate();

  const prevCells: Cell[] = Array.from({ length: primerDia }, (_, i) => ({
    day: diasMesAnterior - primerDia + 1 + i, type: "prev",
  }));
  const currCells: Cell[] = Array.from({ length: diasEnMes }, (_, i) => ({
    day: i + 1, type: "current",
  }));
  const nextCount = (prevCells.length + currCells.length) % 7 === 0
    ? 0 : 7 - ((prevCells.length + currCells.length) % 7);
  const nextCells: Cell[] = Array.from({ length: nextCount }, (_, i) => ({
    day: i + 1, type: "next",
  }));
  const celdas = [...prevCells, ...currCells, ...nextCells];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const resolverFecha = (cell: Cell): { yyyy: number; month: number } => {
    let yyyy = mes.getFullYear(), month = mes.getMonth();
    if (cell.type === "prev") { month -= 1; if (month < 0) { month = 11; yyyy -= 1; } }
    if (cell.type === "next") { month += 1; if (month > 11) { month = 0; yyyy += 1; } }
    return { yyyy, month };
  };

  const esHoyCell = (cell: Cell) => {
    if (cell.type !== "current") return false;
    return new Date(mes.getFullYear(), mes.getMonth(), cell.day).getTime() === hoy.getTime();
  };

  const esSelCell = (cell: Cell) => {
    if (!value || cell.type !== "current") return false;
    const { yyyy, month } = resolverFecha(cell);
    return value === `${yyyy}-${String(month+1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}`;
  };

  const esDisCell = (cell: Cell) => {
    if (!minD) return false;
    const { yyyy, month } = resolverFecha(cell);
    return new Date(yyyy, month, cell.day) < minD;
  };

  const seleccionarCelda = (cell: Cell) => {
    const { yyyy, month } = resolverFecha(cell);
    onChange(`${yyyy}-${String(month+1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}`);
    if (cell.type !== "current") setMes(new Date(yyyy, month, 1));
    setOpen(false);
  };

  const irAHoy = () => {
    setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    onChange(`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`);
    setOpen(false);
  };

  const displayFecha = value
    ? new Date(value + "T12:00").toLocaleDateString("es-MX", { day:"2-digit", month:"short", year:"numeric" })
    : "";

  const nombreAccesible = ariaLabel ?? label ?? "Fecha";

  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${nombreAccesible}${value ? `: ${displayFecha}` : ""}`}
        className={`w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40 ${
          error ? "border-red-400 bg-red-50 text-red-700"
                : value ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100"
                        : "border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-500"
        } hover:border-slate-400 dark:hover:border-slate-500`}
      >
        <Calendar size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
        <span className="truncate">{value ? displayFecha : "Fecha"}</span>
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {open && (
        <PopoverAnclado
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          ancho={352}
          ariaLabel={`Calendario — ${nombreAccesible}`}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-4 select-none"
        >
          {/* Navegación */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100 capitalize">
              {MESES[mes.getMonth()]} {mes.getFullYear()}
            </span>
            <div className="flex gap-0.5">
              <button type="button" aria-label="Mes anterior"
                onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()-1, 1))}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                <ChevronLeft size={16} />
              </button>
              <button type="button" aria-label="Mes siguiente"
                onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()+1, 1))}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Cabecera días */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-semibold tracking-wide py-1 ${
                i === 0 || i === 6 ? "text-red-400" : "text-gray-400 dark:text-gray-500"
              }`}>{d}</div>
            ))}
          </div>

          {/* Días */}
          <div className="grid grid-cols-7 gap-y-1">
            {celdas.map((cell, i) => {
              const isHoy = esHoyCell(cell);
              const isSel = esSelCell(cell);
              const isDis = esDisCell(cell);
              const isAdj = cell.type !== "current";
              const isWeekend = i % 7 === 0 || i % 7 === 6;
              return (
                <button key={`${cell.type}-${cell.day}-${i}`} type="button"
                  disabled={isDis}
                  aria-current={isSel ? "date" : undefined}
                  onClick={() => !isDis && seleccionarCelda(cell)}
                  className={`h-11 w-11 mx-auto text-xs rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                    isSel      ? "bg-blue-500 text-white"
                    : isDis    ? "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                    : isAdj    ? "text-gray-300 dark:text-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    : isHoy    ? "ring-2 ring-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    : isWeekend ? "text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                               : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                  }`}>
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="min-h-[44px] px-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40">
              Borrar
            </button>
            <button type="button" onClick={irAHoy}
              className="min-h-[44px] px-2 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 transition font-semibold rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
              Hoy
            </button>
          </div>
        </PopoverAnclado>
      )}
    </div>
  );
}

// ─── Helper: citas → slots ocupados ──────────────────────────────────────────

export function citasABusySlots(
  citas: Array<{ inicioEn: string; finEn: string; estado: number }>
): string[] {
  const busy = new Set<string>();
  // Solo citas activas (Pendiente=1, Confirmada=2)
  for (const c of citas.filter((x) => x.estado === 1 || x.estado === 2)) {
    const inicio    = new Date(c.inicioEn);
    const fin       = new Date(c.finEn);
    const minInicio = inicio.getHours() * 60 + inicio.getMinutes();
    const minFin    = fin.getHours()   * 60 + fin.getMinutes();
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const slotMin = h * 60 + m;
        if (slotMin < minFin && slotMin + 30 > minInicio) {
          busy.add(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    }
  }
  return Array.from(busy);
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

interface TimePickerProps {
  value: string;           // "HH:MM" o ""
  onChange: (v: string) => void;
  label?: string;
  minTime?: string;        // "HH:MM"
  maxTime?: string;        // "HH:MM"
  busySlots?: string[];    // slots que ya tienen cita — no aparecen
  error?: string;
  compact?: boolean;       // botón pequeño para modales compactos
  /** Nombre accesible cuando no se muestra `label`. */
  ariaLabel?: string;
}

export function TimePicker({ value, onChange, label, minTime, maxTime, busySlots = [], error, compact, ariaLabel }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const nombreAccesible = ariaLabel ?? label ?? "Hora";
  const opciones = HORAS.filter(h =>
    (!minTime || h >= minTime) && (!maxTime || h <= maxTime) && !busySlots.includes(h)
  );

  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${nombreAccesible}${value ? `: ${displayHora(value)}` : ""}`}
        className={compact
          ? `min-h-[44px] flex items-center gap-1 px-2 py-1 rounded border text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 ${
              error ? "border-red-400 bg-red-50 text-red-700"
                    : value ? "border-gray-200 bg-white text-gray-800 dark:bg-slate-700 dark:text-gray-100 dark:border-slate-600"
                            : "border-gray-200 bg-white text-gray-400 dark:bg-slate-700 dark:border-slate-600"
            } hover:border-slate-400`
          : `w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 ${
              error ? "border-red-400 bg-red-50 text-red-700"
                    : value ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100"
                            : "border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-500"
            } hover:border-slate-400 dark:hover:border-slate-500`
        }
      >
        <Clock size={compact ? 11 : 14} className="shrink-0 text-gray-400 dark:text-gray-500" />
        <span className="whitespace-nowrap">{value ? displayHora(value) : "Hora"}</span>
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {open && (
        <PopoverAnclado
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          ancho={180}
          ariaLabel={`Horas — ${nombreAccesible}`}
          className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl p-2 select-none"
        >
          <ul role="listbox" aria-label={nombreAccesible} className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {opciones.map(h => (
              <li key={h}>
                <button type="button"
                  role="option"
                  aria-selected={value === h}
                  onClick={() => { onChange(h); setOpen(false); }}
                  className={`w-full min-h-[44px] flex items-center text-left text-sm px-3 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 ${
                    value === h
                      ? "bg-slate-700 text-white font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                  }`}>
                  {displayHora(h)}
                </button>
              </li>
            ))}
          </ul>
        </PopoverAnclado>
      )}
    </div>
  );
}
