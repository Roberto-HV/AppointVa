import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";

const DIAS  = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// Slots de 30 en 30, de 00:00 a 23:30
const HORAS: string[] = [];
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

// ─── DatePicker ───────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;           // "YYYY-MM-DD" o ""
  onChange: (v: string) => void;
  label?: string;
  minDate?: string;        // "YYYY-MM-DD"
  error?: string;
}

export function DatePicker({ value, onChange, label, minDate, error }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

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

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition ${
          error ? "border-red-400 bg-red-50 text-red-700"
                : value ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100"
                        : "border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-400 dark:text-gray-500"
        } hover:border-slate-400 dark:hover:border-slate-500`}
      >
        <Calendar size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
        <span>{value ? displayFecha : "Fecha"}</span>
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl p-5 w-80 select-none">
          {/* Navegación */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100 capitalize">
              {MESES[mes.getMonth()]} {mes.getFullYear()}
            </span>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()-1, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-500 transition">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()+1, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-500 transition">
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
                  onClick={() => !isDis && seleccionarCelda(cell)}
                  className={`h-9 w-9 mx-auto text-xs rounded-full font-medium transition ${
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
          <div className="flex justify-between mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
            <button type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition font-medium">
              Borrar
            </button>
            <button type="button" onClick={irAHoy}
              className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 transition font-semibold">
              Hoy
            </button>
          </div>
        </div>
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
}

export function TimePicker({ value, onChange, label, minTime, maxTime, busySlots = [], error }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition ${
          error ? "border-red-400 bg-red-50 text-red-700"
                : value ? "border-slate-300 bg-white text-gray-800"
                        : "border-gray-200 bg-white text-gray-400"
        } hover:border-slate-400`}
      >
        <Clock size={14} className="shrink-0 text-gray-400" />
        <span className="whitespace-nowrap">{value ? displayHora(value) : "Hora"}</span>
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-100 rounded-xl shadow-xl p-3 w-40 select-none">
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {HORAS.filter(h =>
              (!minTime || h >= minTime) && (!maxTime || h <= maxTime) && !busySlots.includes(h)
            ).map(h => (
              <button key={h} type="button"
                onClick={() => { onChange(h); setOpen(false); }}
                className={`w-full text-left text-xs px-3 py-1.5 rounded-lg transition ${
                  value === h
                    ? "bg-slate-700 text-white font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}>
                {displayHora(h)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
