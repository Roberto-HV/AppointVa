import type { CitaDto } from "../types";

type CitaRango = Pick<CitaDto, "inicioEn" | "finEn">;

export const HORA_MS = 3_600_000;
const SPAN_MINIMO_H = 4;

/** Rango en horas enteras que cubre todas las citas (al menos 4 h). */
export function rangoLinea(citas: CitaRango[]): { inicio: number; fin: number } | null {
  if (citas.length === 0) return null;
  const inicios = citas.map((c) => new Date(c.inicioEn).getTime());
  const fines = citas.map((c) => new Date(c.finEn).getTime());
  const primero = new Date(Math.min(...inicios));
  primero.setMinutes(0, 0, 0);
  const ultimo = new Date(Math.max(...fines));
  if (ultimo.getMinutes() || ultimo.getSeconds()) ultimo.setHours(ultimo.getHours() + 1, 0, 0, 0);
  const inicio = primero.getTime();
  const fin = Math.max(ultimo.getTime(), inicio + SPAN_MINIMO_H * HORA_MS);
  return { inicio, fin };
}


export const MAX_CARRILES = 3;

export interface CitaEnCarril<T> {
  cita: T;
  /** Sub-carril (0 arriba) o `null` si no cupo en los `max` carriles. */
  carril: number | null;
}

/**
 * Reparte las citas en sub-carriles para que las que se traslapan no se tapen:
 * asignación voraz por hora de inicio, cada cita al primer carril libre (cuyo
 * último fin es ≤ a su inicio). Más allá de `max` carriles la cita queda sin
 * carril (`null`) y se cuenta en `ocultas` para el indicador "+N".
 * Devuelve las citas en el orden de entrada.
 */
export function asignarCarriles<T extends CitaRango>(
  citas: T[],
  max = MAX_CARRILES,
): { asignadas: CitaEnCarril<T>[]; carriles: number; ocultas: number } {
  const orden = citas
    .map((cita, i) => ({ cita, i, inicio: new Date(cita.inicioEn).getTime(), fin: new Date(cita.finEn).getTime() }))
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin || a.i - b.i);
  const finCarril: number[] = [];
  const carrilDe = new Map<number, number | null>();
  let ocultas = 0;
  for (const c of orden) {
    let carril = finCarril.findIndex((fin) => fin <= c.inicio);
    if (carril === -1 && finCarril.length < max) carril = finCarril.push(c.fin) - 1;
    else if (carril !== -1) finCarril[carril] = c.fin;
    if (carril === -1) {
      ocultas++;
      carrilDe.set(c.i, null);
    } else {
      carrilDe.set(c.i, carril);
    }
  }
  return {
    asignadas: citas.map((cita, i) => ({ cita, carril: carrilDe.get(i) ?? null })),
    carriles: Math.max(finCarril.length, 1),
    ocultas,
  };
}
