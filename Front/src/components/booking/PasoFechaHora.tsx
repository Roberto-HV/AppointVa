import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import type { SlotDisponible } from "../../types";
import { ChevronLeft, ChevronRight, Sun, Sunrise, Moon } from "lucide-react";

interface Props {
  servicioId: string;
  empleadoId: string | null;
  seleccionado: SlotDisponible | null;
  onSeleccionar: (slot: SlotDisponible) => void;
}

const DIAS_CORTOS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function lunesDeSemanaDe(d: Date): Date {
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const dow = dia.getDay();
  dia.setDate(dia.getDate() - ((dow + 6) % 7));
  return dia;
}

function textoMesSemana(dias: Date[]): string {
  const mes0 = dias[0].getMonth();
  const mes6 = dias[6].getMonth();
  const anio = dias[0].getFullYear();
  if (mes0 !== mes6) return `${MESES_CORTOS[mes0]} – ${MESES_CORTOS[mes6]} ${anio}`;
  return `${MESES[mes0]} ${anio}`;
}

export default function PasoFechaHora({ servicioId, empleadoId, seleccionado, onSeleccionar }: Props) {
  const [semanaRef, setSemanaRef] = useState(() => lunesDeSemanaDe(new Date()));
  const [fechaSel, setFechaSel] = useState<string | null>(null);

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaRef);
    d.setDate(semanaRef.getDate() + i);
    return d;
  });

  const semanaHoy = lunesDeSemanaDe(new Date());
  const puedeIrAtras = semanaRef > semanaHoy;

  const semanaAnterior = () => {
    if (!puedeIrAtras) return;
    const s = new Date(semanaRef);
    s.setDate(s.getDate() - 7);
    setSemanaRef(s);
    setFechaSel(null);
  };

  const semanaSiguiente = () => {
    const s = new Date(semanaRef);
    s.setDate(s.getDate() + 7);
    setSemanaRef(s);
    setFechaSel(null);
  };

  const seleccionarFecha = (dia: Date) => {
    if (dia < hoy()) return;
    setFechaSel(fechaISO(dia));
  };

  const { data: slots = [], isFetching, isError } = useQuery({
    queryKey: ["slots", servicioId, empleadoId, fechaSel],
    queryFn: () => publicoApi.obtenerDisponibilidad(servicioId, empleadoId, fechaSel!),
    enabled: !!fechaSel,
    retry: 2,
    retryDelay: 1000,
  });

  const franjas = fechaSel && !isFetching && !isError && slots.length > 0
    ? [
        { label: "Mañana",  Icon: Sunrise, slots: slots.filter(s => new Date(s.inicio).getHours() < 12) },
        { label: "Tarde",   Icon: Sun,     slots: slots.filter(s => { const h = new Date(s.inicio).getHours(); return h >= 12 && h < 18; }) },
        { label: "Noche",   Icon: Moon,    slots: slots.filter(s => new Date(s.inicio).getHours() >= 18) },
      ].filter(f => f.slots.length > 0)
    : [];

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Elige fecha y hora</h2>
      <p className="text-sm text-slate-500 mb-5">Selecciona el día y horario que prefieras</p>

      {/* Encabezado de semana */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-700">
          {textoMesSemana(diasSemana)}
        </span>
        <div className="flex gap-1">
          <button
            onClick={semanaAnterior}
            disabled={!puedeIrAtras}
            aria-label="Semana anterior"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} className="text-slate-600" />
          </button>
          <button
            onClick={semanaSiguiente}
            aria-label="Semana siguiente"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition"
          >
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Tarjetas de días — 7 columnas */}
      <div className="grid grid-cols-7 gap-1 mb-5">
        {diasSemana.map((dia) => {
          const iso = fechaISO(dia);
          const pasado = dia < hoy();
          const esHoy = iso === fechaISO(new Date());
          const seleccionada = iso === fechaSel;

          return (
            <button
              key={iso}
              onClick={() => seleccionarFecha(dia)}
              disabled={pasado}
              className={`flex flex-col items-center py-2.5 rounded-2xl transition-all duration-150
                ${seleccionada
                  ? "bg-slate-700 text-white shadow-md"
                  : pasado
                  ? "opacity-30 cursor-not-allowed"
                  : esHoy
                  ? "bg-white border-2 border-slate-700 text-slate-800 hover:bg-slate-700/5"
                  : "bg-white border border-slate-100 text-slate-700 hover:border-slate-300 hover:shadow-sm"
                }`}
            >
              <span className={`text-[9px] font-semibold uppercase mb-1 tracking-wide
                ${seleccionada ? "text-white/70" : "text-slate-400"}`}>
                {DIAS_CORTOS[dia.getDay()]}
              </span>
              <span className={`text-sm font-bold leading-none
                ${seleccionada ? "text-white" : esHoy ? "text-slate-700" : "text-slate-800"}`}>
                {dia.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots de horario */}
      {fechaSel && (
        <div className="animate-step-in">
          {isFetching ? (
            <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-slate-400">
              <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
              Cargando horarios…
            </div>
          ) : isError ? (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-4 text-center">
              <p className="text-sm text-red-600 mb-2">No se pudieron cargar los horarios.</p>
              <button
                onClick={() => setFechaSel(fechaSel)}
                className="text-xs text-red-500 font-semibold hover:underline"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600">Sin disponibilidad</p>
              <p className="text-xs text-slate-400 mt-0.5">Prueba con otro día de la semana</p>
            </div>
          ) : (
            <div className="space-y-4">
              {franjas.map(({ label, Icon, slots: slotsFranja }) => (
                <div key={label}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={12} className="text-slate-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {slotsFranja.map((slot) => {
                      const activo = seleccionado?.inicio === slot.inicio;
                      return (
                        <button
                          key={slot.inicio}
                          onClick={() => onSeleccionar(slot)}
                          className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all
                            ${activo
                              ? "border-slate-700 bg-slate-700 text-white shadow-sm"
                              : "border-slate-100 bg-white hover:border-slate-700 text-slate-700 hover:shadow-sm"
                            }`}
                        >
                          {slot.horaTexto}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
