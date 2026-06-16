import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import type { SlotDisponible } from "../../types";

interface Props {
  servicioId: string;
  empleadoId: string | null;
  seleccionado: SlotDisponible | null;
  onSeleccionar: (slot: SlotDisponible) => void;
}

function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fechaISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DIAS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PasoFechaHora({ servicioId, empleadoId, seleccionado, onSeleccionar }: Props) {
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [fechaSel, setFechaSel] = useState<string | null>(null);

  const primerDia = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
  const ultimoDia = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0);
  const diasEnMes = ultimoDia.getDate();
  const offsetInicio = primerDia.getDay(); // domingo=0

  const { data: slots = [], isFetching, isError } = useQuery({
    queryKey: ["slots", servicioId, empleadoId, fechaSel],
    queryFn: () => publicoApi.obtenerDisponibilidad(servicioId, empleadoId, fechaSel!),
    enabled: !!fechaSel,
    retry: 2,
    retryDelay: 1000,
  });

  const mesAnterior = () =>
    setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() - 1, 1));
  const mesSiguiente = () =>
    setMesRef(new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 1));

  const seleccionarFecha = (dia: number) => {
    const d = new Date(mesRef.getFullYear(), mesRef.getMonth(), dia);
    if (d < hoy()) return;
    setFechaSel(fechaISO(d));
  };

  const mesMinimo = new Date(hoy().getFullYear(), hoy().getMonth(), 1);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Elige fecha y hora</h2>

      {/* Calendario */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
        {/* Header mes */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={mesAnterior}
            disabled={mesRef <= mesMinimo}
            aria-label="Mes anterior"
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {MESES[mesRef.getMonth()]} {mesRef.getFullYear()}
          </span>
          <button onClick={mesSiguiente} aria-label="Mes siguiente" className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            ›
          </button>
        </div>

        {/* Días de semana */}
        <div className="grid grid-cols-7 mb-1">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: offsetInicio }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: diasEnMes }).map((_, i) => {
            const dia = i + 1;
            const fecha = new Date(mesRef.getFullYear(), mesRef.getMonth(), dia);
            const pasado = fecha < hoy();
            const esHoy = fechaISO(fecha) === fechaISO(hoy());
            const selFecha = fechaISO(fecha) === fechaSel;

            return (
              <button
                key={dia}
                onClick={() => seleccionarFecha(dia)}
                disabled={pasado}
                className={`text-sm py-1.5 rounded-lg transition font-medium
                  ${pasado ? "text-gray-300 cursor-not-allowed" : ""}
                  ${selFecha ? "bg-primary text-white" : ""}
                  ${esHoy && !selFecha ? "border border-primary text-primary" : ""}
                  ${!pasado && !selFecha ? "hover:bg-gray-100 text-gray-700" : ""}`}
              >
                {dia}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {fechaSel && (
        <div>
          {isFetching ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
              Cargando horarios...
            </div>
          ) : isError ? (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center">
              <p className="text-sm text-red-600 mb-2">No se pudieron cargar los horarios.</p>
              <button
                onClick={() => setFechaSel(fechaSel)}
                className="text-xs text-red-600 font-medium hover:underline"
              >
                Intentar de nuevo
              </button>
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No hay horarios disponibles para este día.
            </p>
          ) : (
            (() => {
              const franjas = [
                { label: "🌅 Mañana",  slots: slots.filter(s => new Date(s.inicio).getHours() < 12) },
                { label: "☀️ Tarde",   slots: slots.filter(s => { const h = new Date(s.inicio).getHours(); return h >= 12 && h < 18; }) },
                { label: "🌙 Noche",   slots: slots.filter(s => new Date(s.inicio).getHours() >= 18) },
              ].filter(f => f.slots.length > 0);
              return (
                <div className="space-y-4">
                  {franjas.map(({ label, slots: slotsFranja }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 font-medium mb-2">{label}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {slotsFranja.map((slot) => {
                          const activo = seleccionado?.inicio === slot.inicio;
                          return (
                            <button
                              key={slot.inicio}
                              onClick={() => onSeleccionar(slot)}
                              className={`py-2 rounded-lg text-sm font-medium border-2 transition
                                ${activo ? "border-primary bg-primary text-white" : "border-gray-100 hover:border-primary text-gray-700"}`}
                            >
                              {slot.horaTexto}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
