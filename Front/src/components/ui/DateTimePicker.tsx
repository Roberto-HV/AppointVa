import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";

const DIAS  = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
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

  const minD = minDate ? new Date(minDate + "T00:00") : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();

  const primerDia  = mes.getDay();
  const diasEnMes  = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const celdas     = [...Array(primerDia).fill(null), ...Array.from({length: diasEnMes}, (_, i) => i + 1)];

  const seleccionarDia = (dia: number) => {
    const yyyy = mes.getFullYear();
    const mm   = String(mes.getMonth() + 1).padStart(2,"0");
    const dd   = String(dia).padStart(2,"0");
    onChange(`${yyyy}-${mm}-${dd}`);
    setOpen(false);
  };

  const esSel = (dia: number) => {
    if (!value) return false;
    const yyyy = mes.getFullYear(), mm = String(mes.getMonth()+1).padStart(2,"0"), dd = String(dia).padStart(2,"0");
    return value === `${yyyy}-${mm}-${dd}`;
  };

  const esDis = (dia: number) => {
    const d = new Date(mes.getFullYear(), mes.getMonth(), dia);
    return d < minD;
  };

  const displayFecha = value
    ? new Date(value + "T12:00").toLocaleDateString("es-MX", { day:"2-digit", month:"short", year:"numeric" })
    : "";

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
        <Calendar size={14} className="shrink-0 text-gray-400" />
        <span>{value ? displayFecha : "Fecha"}</span>
      </button>

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-gray-100 rounded-xl shadow-xl p-4 w-64 select-none">
          {/* Navegación */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()-1, 1))}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-gray-800 capitalize">
              {MESES[mes.getMonth()]} {mes.getFullYear()}
            </span>
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()+1, 1))}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Cabecera */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
          </div>

          {/* Días */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {celdas.map((dia, i) => {
              if (dia === null) return <div key={`e-${i}`} />;
              const sel = esSel(dia), dis = esDis(dia);
              return (
                <button key={dia} type="button" disabled={dis} onClick={() => seleccionarDia(dia)}
                  className={`h-8 w-8 mx-auto text-xs rounded-lg font-medium transition ${
                    sel ? "bg-slate-700 text-white"
                        : dis ? "text-gray-300 cursor-not-allowed"
                              : "text-gray-700 hover:bg-gray-100"
                  }`}>
                  {dia}
                </button>
              );
            })}
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
        <span>{value ? displayHora(value) : "Hora"}</span>
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
