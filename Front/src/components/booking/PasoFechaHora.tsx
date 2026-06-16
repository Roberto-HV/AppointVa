import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
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

function sumarDias(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

const DIAS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PasoFechaHora({ servicioId, empleadoId, seleccionado, onSeleccionar }: Props) {
  const [mesRef, setMesRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [fechaSel, setFechaSel] = useState<string | null>(null);
  const [buscandoProxima, setBuscandoProxima] = useState(false);

  const primerDia = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
  const ultimoDia = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0);
  const diasEnMes = ultimoDia.getDate();
  const offsetInicio = primerDia.getDay();

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

  const buscarProximaDisponibilidad = async () => {
    setBuscandoProxima(true);
    try {
      for (let i = 0; i <= 30; i++) {
        const fecha = fechaISO(sumarDias(hoy(), i));
        const result = await publicoApi.obtenerDisponibilidad(servicioId, empleadoId, fecha);
        if (result.length > 0) {
          const d = new Date(fecha + "T00:00:00");
          setMesRef(new Date(d.getFullYear(), d.getMonth(), 1));
          setFechaSel(fecha);
          break;
        }
      }
    } finally {
      setBuscandoProxima(false);
    }
  };

  const mesMinimo = new Date(hoy().getFullYear(), hoy().getMonth(), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Elige fecha y hora</h2>
        <button
          onClick={buscarProximaDisponibilidad}
          disabled={buscandoProxima}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition disabled:opacity-50"
        >
          {buscandoProxima ? (
            <>
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Buscando…
            </>
          ) : (
            <>
              <Zap size={12} />
              Próxima disponible
            </>
          )}
        </button>
      </div>

      {/* Calendario */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={mesAnterior}
            disabled={mesRef <= mesMinimo}
            aria-label="Mes anterior"
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition text-gray-500"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {MESES[mesRef.getMonth()]} {mesRef.getFullYear()}
          </span>
          <button onClick={mesSiguiente} aria-label="Mes siguiente" className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DIAS.map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
          ))}
        </div>

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
                className={`relative text-sm py-2 rounded-xl transition font-medium
                  ${pasado ? "text-gray-300 cursor-not-allowed" : ""}
                  ${selFecha ? "bg-primary text-white shadow-sm" : ""}
                  ${esHoy && !selFecha ? "border border-primary text-primary" : ""}
                  ${!pasado && !selFecha ? "hover:bg-primary/10 text-gray-700" : ""}`}
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
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded animate-pulse w-32" />
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
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
            <div className="text-center py-5">
              <p className="text-sm text-gray-400 mb-2">No hay horarios disponibles este día.</p>
              <button
                onClick={buscarProximaDisponibilidad}
                disabled={buscandoProxima}
                className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
              >
                {buscandoProxima ? "Buscando…" : "Buscar próxima fecha disponible →"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500">Horarios disponibles</p>
                <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                  {slots.length} disponible{slots.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const activo = seleccionado?.inicio === slot.inicio;
                  return (
                    <button
                      key={slot.inicio}
                      onClick={() => onSeleccionar(slot)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all
                        ${activo
                          ? "border-primary bg-primary text-white shadow-sm scale-105"
                          : "border-gray-100 hover:border-primary hover:bg-primary/5 text-gray-700"
                        }`}
                    >
                      {slot.horaTexto}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!fechaSel && (
        <p className="text-sm text-gray-400 text-center py-3">
          Selecciona una fecha en el calendario
        </p>
      )}
    </div>
  );
}
