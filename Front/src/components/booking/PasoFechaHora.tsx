import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { publicoApi } from "../../api/publico";
import type { SlotDisponible } from "../../types";
import { brandAccent } from "../../lib/colorUtils";
import { fechaLocal } from "../../utils/fechas";
import { ChevronLeft, ChevronRight, Sun, Sunrise, Moon } from "lucide-react";

interface Props {
  servicioId: string;
  empleadoId: string | null;
  seleccionado: SlotDisponible | null;
  onSeleccionar: (slot: SlotDisponible) => void;
  onLimpiarSlot?: () => void;
  color?: string;
  diasAnticipacionMinima?: number;
  /** Ruta de la lista de espera; si llega, se ofrece cuando no hay horarios. */
  enlaceListaEspera?: string;
}

const DIAS_CORTOS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
/** Lo que el lector de pantalla oye tras la fecha; el punto de color no le llega. */
const DETALLE_DISPONIBILIDAD: Record<EstadoDia, string> = {
  "con-horarios": ", con horarios",
  "sin-horarios": ", sin horarios",
  cargando: "",
  error: ", no se pudo cargar; toca para reintentar",
};
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

/** Un minuto de caché: volver a una semana ya vista no repite sus 7 consultas. */
const VIGENCIA_DISPONIBILIDAD = 60_000;
/** El día elegido reintenta: es el que el visitante está esperando ver. */
const OPCIONES_CONSULTA = { retry: 2, retryDelay: 1000, staleTime: VIGENCIA_DISPONIBILIDAD } as const;
/**
 * La precarga del resto de la semana es especulativa: sin reintentos, para que un
 * backend degradado no reciba hasta 21 peticiones por semana. Un día que falla se
 * reintenta al tocarlo, ya con la consulta del día elegido.
 */
const OPCIONES_PRECARGA = { retry: 0, staleTime: VIGENCIA_DISPONIBILIDAD } as const;

type EstadoDia = "con-horarios" | "sin-horarios" | "cargando" | "error";

function estadoDeConsulta(consulta?: { data?: SlotDisponible[]; isError: boolean }): EstadoDia {
  if (consulta?.data) return consulta.data.length > 0 ? "con-horarios" : "sin-horarios";
  if (consulta?.isError) return "error";
  return "cargando";
}

function hoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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

export default function PasoFechaHora({ servicioId, empleadoId, seleccionado, onSeleccionar, onLimpiarSlot, color = "#334155", diasAnticipacionMinima = 0, enlaceListaEspera }: Props) {
  // Al volver a este paso con un horario ya elegido, su día sigue a la vista.
  const [semanaRef, setSemanaRef] = useState(() =>
    lunesDeSemanaDe(seleccionado ? new Date(seleccionado.inicio) : new Date())
  );
  const [fechaElegida, setFechaElegida] = useState<string | null>(() =>
    seleccionado ? seleccionado.inicio.slice(0, 10) : null
  );
  // Las píldoras activas llevan texto blanco: el hex de marca crudo no garantiza
  // contraste (un dorado deja el horario ilegible), el acento derivado sí.
  const acento = useMemo(() => brandAccent(color), [color]);

  const fechaMinima = (() => {
    const f = hoy();
    f.setDate(f.getDate() + diasAnticipacionMinima);
    return f;
  })();

  const diasSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaRef);
    d.setDate(semanaRef.getDate() + i);
    return d;
  });

  // Disponibilidad de toda la semana visible: cada día muestra si tiene horarios
  // sin que el visitante tenga que tocarlos uno por uno. Comparte caché con la
  // consulta del día elegido, así que tocar un día ya cargado no vuelve a pedirlo.
  // El día elegido explícitamente queda fuera: lo lleva su propia consulta, con reintentos.
  const fechasReservables = diasSemana.filter((d) => d >= fechaMinima).map(fechaLocal);
  const fechasPrecarga = fechasReservables.filter((f) => f !== fechaElegida);
  const disponibilidadSemana = useQueries({
    queries: fechasPrecarga.map((fecha) => ({
      queryKey: ["slots", servicioId, empleadoId, fecha],
      queryFn: () => publicoApi.obtenerDisponibilidad(servicioId, empleadoId, fecha),
      ...OPCIONES_PRECARGA,
    })),
  });
  const estadoPrecarga = (fecha: string) =>
    estadoDeConsulta(disponibilidadSemana[fechasPrecarga.indexOf(fecha)]);

  // Sin elección explícita se abre el primer día con horarios, en orden: no salta a
  // un día posterior mientras uno anterior sigue cargando. Un día que falló no
  // bloquea a los siguientes: se salta y queda marcado para reintentarlo.
  const primeraConHorarios = fechaElegida ? null : (() => {
    for (const fecha of fechasReservables) {
      const estado = estadoPrecarga(fecha);
      if (estado === "con-horarios") return fecha;
      if (estado === "cargando") return null;
    }
    return null;
  })();
  const fechaSel = fechaElegida ?? primeraConHorarios;

  const consultaDia = useQuery({
    queryKey: ["slots", servicioId, empleadoId, fechaSel],
    queryFn: () => publicoApi.obtenerDisponibilidad(servicioId, empleadoId, fechaSel!),
    enabled: !!fechaSel,
    ...OPCIONES_CONSULTA,
  });
  const { data: slots = [], isFetching, isError, refetch } = consultaDia;

  const estadoDia = (fecha: string): EstadoDia =>
    fecha === fechaSel ? estadoDeConsulta(consultaDia) : estadoPrecarga(fecha);
  const semanaSinHorarios =
    fechasReservables.length > 0 && fechasReservables.every((f) => estadoDia(f) === "sin-horarios");
  const hayDiasConError = fechasReservables.some((f) => estadoDia(f) === "error");
  const siguienteConHorarios = fechaSel
    ? fechasReservables.find((f) => f > fechaSel && estadoDia(f) === "con-horarios") ?? null
    : null;

  const semanaFechaMinima = lunesDeSemanaDe(fechaMinima);
  const puedeIrAtras = semanaRef > semanaFechaMinima;

  // Cambiar de semana suelta el horario elegido: si siguiera activo, «Continuar»
  // avanzaría con un horario que ya no está a la vista.
  const cambiarSemana = (dias: number) => {
    const s = new Date(semanaRef);
    s.setDate(s.getDate() + dias);
    setSemanaRef(s);
    setFechaElegida(null);
    if (seleccionado) onLimpiarSlot?.();
  };

  const semanaAnterior = () => {
    if (!puedeIrAtras) return;
    cambiarSemana(-7);
  };

  const semanaSiguiente = () => cambiarSemana(7);

  const elegirFecha = (fecha: string) => {
    // Tocar de nuevo un día que no cargó lo reintenta.
    if (fecha === fechaSel && isError) void refetch();
    setFechaElegida(fecha);
    if (fecha !== fechaSel) onLimpiarSlot?.();
  };

  const seleccionarFecha = (dia: Date) => {
    if (dia < fechaMinima) return;
    elegirFecha(fechaLocal(dia));
  };

  const franjas = fechaSel && !isFetching && !isError && slots.length > 0
    ? [
        { label: "Mañana",  Icon: Sunrise, slots: slots.filter(s => parseInt(s.inicio.slice(11, 13), 10) < 12) },
        { label: "Tarde",   Icon: Sun,     slots: slots.filter(s => { const h = parseInt(s.inicio.slice(11, 13), 10); return h >= 12 && h < 18; }) },
        { label: "Noche",   Icon: Moon,    slots: slots.filter(s => parseInt(s.inicio.slice(11, 13), 10) >= 18) },
      ].filter(f => f.slots.length > 0)
    : [];

  const textoDia = (fecha: string) => {
    const [a, m, d] = fecha.split("-").map(Number);
    const dia = new Date(a, m - 1, d);
    return `${DIAS_LARGOS[dia.getDay()]} ${dia.getDate()}`;
  };

  // Salidas del estado vacío: el siguiente día con horarios, la semana siguiente y,
  // si el negocio la tiene, la lista de espera.
  const salidasSinHorarios = (
    <div className="mt-4 flex flex-col items-center gap-2">
      {siguienteConHorarios ? (
        <button
          type="button"
          onClick={() => elegirFecha(siguienteConHorarios)}
          className="min-h-[44px] rounded-xl border-2 px-4 text-sm font-semibold transition hover:opacity-90"
          style={{ borderColor: acento, color: acento }}
        >
          {`Próximo disponible: ${textoDia(siguienteConHorarios)}`}
        </button>
      ) : (
        <button
          type="button"
          onClick={semanaSiguiente}
          className="min-h-[44px] rounded-xl border-2 px-4 text-sm font-semibold transition hover:opacity-90"
          style={{ borderColor: acento, color: acento }}
        >
          Ver la semana siguiente
        </button>
      )}
      {enlaceListaEspera && (
        <Link
          to={enlaceListaEspera}
          className="text-sm text-slate-600 hover:text-slate-800 underline underline-offset-2 transition"
        >
          Únete a la lista de espera
        </Link>
      )}
    </div>
  );

  return (
    <div>
      <h2 tabIndex={-1} className="text-xl font-bold text-slate-900 mb-1 outline-none">Elige fecha y hora</h2>
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
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-slate-100 disabled:opacity-25 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <button
            onClick={semanaSiguiente}
            aria-label="Semana siguiente"
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-slate-100 transition"
          >
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Tarjetas de días — 7 columnas */}
      <div className="grid grid-cols-7 gap-1 mb-5">
        {diasSemana.map((dia) => {
          const iso = fechaLocal(dia);
          const pasado = dia < fechaMinima;
          const esHoy = iso === fechaLocal(new Date());
          const seleccionada = iso === fechaSel;
          const disponibilidad = pasado ? "cargando" : estadoDia(iso);
          // Atenuado, no deshabilitado: el visitante aún puede abrirlo y ver por qué.
          const sinHorarios = disponibilidad === "sin-horarios" && !seleccionada;
          const etiqueta =
            `${DIAS_LARGOS[dia.getDay()]} ${dia.getDate()} de ${MESES[dia.getMonth()].toLowerCase()}` +
            (esHoy ? ", hoy" : "") +
            (pasado ? "" : DETALLE_DISPONIBILIDAD[disponibilidad]);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => seleccionarFecha(dia)}
              disabled={pasado}
              aria-label={etiqueta}
              aria-pressed={seleccionada}
              aria-current={esHoy ? "date" : undefined}
              data-fecha={iso}
              data-disponibilidad={disponibilidad}
              className={`flex flex-col items-center py-2.5 rounded-2xl transition-all duration-150
                ${pasado
                  ? "opacity-30 cursor-not-allowed bg-white border border-slate-100"
                  : esHoy && !seleccionada
                  ? "bg-white border-2 text-slate-800"
                  : !seleccionada
                  ? "bg-white border border-slate-100 text-slate-700 hover:border-slate-300 hover:shadow-sm"
                  : ""
                }
                ${sinHorarios ? "opacity-50" : ""}`}
              style={
                seleccionada
                  ? { background: acento, color: "#fff", boxShadow: `0 4px 12px ${acento}40` }
                  : esHoy && !seleccionada
                  ? { borderColor: acento }
                  : undefined
              }
            >
              <span className={`text-xs font-semibold uppercase mb-1
                ${seleccionada ? "text-white/90" : "text-slate-500"}`}>
                {DIAS_CORTOS[dia.getDay()]}
              </span>
              <span className={`text-sm font-bold leading-none
                ${seleccionada ? "text-white" : esHoy ? "text-slate-700" : "text-slate-800"}`}>
                {dia.getDate()}
              </span>
              {/* Punto de disponibilidad; el hueco se reserva siempre para no mover la fila.
                  Un día que no cargó lleva un punto rojo: tocarlo lo reintenta. */}
              <span
                aria-hidden="true"
                className={`mt-1 h-1 w-1 rounded-full ${disponibilidad === "error" ? (seleccionada ? "bg-white" : "bg-red-600") : ""}`}
                style={disponibilidad === "error" ? undefined : {
                  background: disponibilidad === "con-horarios"
                    ? (seleccionada ? "#fff" : acento)
                    : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>

      {hayDiasConError && (
        <p className="-mt-3 mb-4 flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
          No pudimos revisar algunos días. Toca uno marcado para intentarlo de nuevo.
        </p>
      )}

      {/* Semana completa sin horarios: no hay día que abrir */}
      {!fechaSel && semanaSinHorarios && (
        <div className="text-center py-6">
          <p className="text-sm font-medium text-slate-600">Sin disponibilidad esta semana</p>
          {salidasSinHorarios}
        </div>
      )}

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
                onClick={() => refetch()}
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
              <p className="text-sm font-medium text-slate-600">Sin disponibilidad este día</p>
              {salidasSinHorarios}
            </div>
          ) : (
            <div className="space-y-4">
              {franjas.map(({ label, Icon, slots: slotsFranja }) => (
                <div key={label} role="group" aria-label={label}>
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
                          type="button"
                          onClick={() => onSeleccionar(slot)}
                          aria-pressed={activo}
                          className="min-h-[44px] px-1 rounded-xl text-xs font-semibold border-2 transition-all flex items-center justify-center"
                          style={activo
                            ? { borderColor: acento, background: acento, color: "#fff", boxShadow: `0 2px 8px ${acento}40` }
                            : { borderColor: "#f1f5f9", background: "#fff", color: "#475569" }}
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
