import type { BloqueoNegocioDto, HorarioDiaDto } from "../types";
import { fechaLocal } from "../utils/fechas";

// ── Reglas de la agenda del panel ─────────────────────────────────────────────
//
// Calendario y Línea de tiempo comparten estas reglas para decidir si un hueco
// de la rejilla abre "Nueva cita": no en el pasado, no en un día cerrado (sin
// horario o bloqueado) y no fuera del horario del negocio. El servidor vuelve a
// validar al crear; aquí solo se evita ofrecer un hueco que no se puede usar.
//
// Las horas son las del navegador, igual que las que dibuja la rejilla.

/** Minutos a los que se ajusta un clic en la rejilla. */
export const PASO_HUECO_MIN = 15;

/** "HH:mm" → minutos desde la medianoche. */
function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Intervalos de apertura del día como [inicio, fin) en minutos, o [] si el negocio cierra. */
export function intervalosDelDia(
  dia: Date,
  horarios: HorarioDiaDto[] | undefined,
  bloqueados: BloqueoNegocioDto[] | undefined,
): [number, number][] {
  if (bloqueados?.some((b) => b.fecha === fechaLocal(dia))) return [];
  const horario = horarios?.find((h) => h.diaSemana === dia.getDay());
  if (!horario || !horario.activo) return [];
  return horario.intervalos.map((i) => [minutosDe(i.horaInicio), minutosDe(i.horaFin)] as [number, number]);
}

/** Sin horarios cargados no se sabe si cierra: se trata como abierto. */
export function diaCerrado(
  dia: Date,
  horarios: HorarioDiaDto[] | undefined,
  bloqueados: BloqueoNegocioDto[] | undefined,
): boolean {
  if (!horarios || horarios.length === 0) return !!bloqueados?.some((b) => b.fecha === fechaLocal(dia));
  return intervalosDelDia(dia, horarios, bloqueados).length === 0;
}

/**
 * Horas enteras [inicio, fin) que cubre el horario del negocio en la semana.
 * Sin horario, el rango por defecto de la rejilla (7 a 21).
 */
export function rangoDelHorario(horarios: HorarioDiaDto[] | undefined): [number, number] {
  const intervalos = (horarios ?? []).filter((h) => h.activo).flatMap((h) => h.intervalos);
  if (intervalos.length === 0) return [7, 21];
  const inicio = Math.min(...intervalos.map((i) => minutosDe(i.horaInicio)));
  const fin = Math.max(...intervalos.map((i) => minutosDe(i.horaFin)));
  return [Math.floor(inicio / 60), Math.min(24, Math.ceil(fin / 60))];
}

export type MotivoHuecoBloqueado = "pasado" | "cerrado" | "fueraDeHorario";

/**
 * Por qué no se puede agendar en ese instante, o null si se puede.
 * Un hueco en curso (empezó hace menos de un paso) cuenta como pasado: la cita
 * empezaría antes de agendarse.
 */
export function motivoHuecoBloqueado(
  inicio: Date,
  horarios: HorarioDiaDto[] | undefined,
  bloqueados: BloqueoNegocioDto[] | undefined,
  ahora: Date = new Date(),
): MotivoHuecoBloqueado | null {
  if (inicio.getTime() < ahora.getTime()) return "pasado";
  if (diaCerrado(inicio, horarios, bloqueados)) return "cerrado";
  if (horarios && horarios.length > 0) {
    const min = inicio.getHours() * 60 + inicio.getMinutes();
    const dentro = intervalosDelDia(inicio, horarios, bloqueados).some(([a, b]) => min >= a && min < b);
    if (!dentro) return "fueraDeHorario";
  }
  return null;
}

export const TEXTO_HUECO_BLOQUEADO: Record<MotivoHuecoBloqueado, string> = {
  pasado: "Ya pasó",
  cerrado: "Cerrado",
  fueraDeHorario: "Fuera de horario",
};

/**
 * Instante del hueco bajo el puntero: `y` en px desde el borde superior de la
 * rejilla, ajustado hacia abajo al paso (un clic a las 10:07 es la de 10:00).
 */
export function instanteEnRejilla(dia: Date, y: number, horaInicio: number, pxPorHora: number, paso = PASO_HUECO_MIN): Date {
  const minutos = Math.max(0, Math.floor(((y / pxPorHora) * 60) / paso) * paso);
  const d = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), horaInicio, 0, 0, 0);
  d.setMinutes(d.getMinutes() + minutos);
  return d;
}

/**
 * Bandas fuera del horario para sombrear la rejilla: [desde, hasta) en horas
 * decimales, recortadas al rango visible. Un día cerrado es una sola banda.
 */
export function bandasFueraDeHorario(
  dia: Date,
  horarios: HorarioDiaDto[] | undefined,
  bloqueados: BloqueoNegocioDto[] | undefined,
  rango: { inicio: number; fin: number },
): [number, number][] {
  if (!horarios || horarios.length === 0) {
    return diaCerrado(dia, horarios, bloqueados) ? [[rango.inicio, rango.fin]] : [];
  }
  const abiertos = intervalosDelDia(dia, horarios, bloqueados)
    .map(([a, b]) => [a / 60, b / 60] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  const bandas: [number, number][] = [];
  let cursor = rango.inicio;
  for (const [a, b] of abiertos) {
    if (a > cursor) bandas.push([cursor, Math.min(a, rango.fin)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < rango.fin) bandas.push([cursor, rango.fin]);
  return bandas.filter(([a, b]) => b > a);
}

/**
 * Hora (decimal) a la que desplazar la rejilla al abrir: la actual si el rango
 * mostrado incluye hoy, si no la apertura del primer día abierto, si no la
 * primera cita. Siempre una hora antes, para dar contexto.
 */
export function horaDeDesplazamiento(
  dias: Date[],
  horarios: HorarioDiaDto[] | undefined,
  bloqueados: BloqueoNegocioDto[] | undefined,
  primeraCita: Date | null,
  ahora: Date = new Date(),
): number | null {
  if (dias.some((d) => d.toDateString() === ahora.toDateString())) {
    return Math.max(0, ahora.getHours() - 1);
  }
  for (const d of dias) {
    const intervalos = intervalosDelDia(d, horarios, bloqueados);
    if (intervalos.length > 0) return Math.max(0, Math.floor(intervalos[0][0] / 60) - 1);
  }
  return primeraCita ? Math.max(0, primeraCita.getHours() - 1) : null;
}
