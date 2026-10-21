import type { HorarioDiaDto } from "../types";

// ── Reglas de los editores de horario ──────────────────────────────────────────
//
// Una sola regla para el horario del negocio y el de cada empleado. Antes cada
// pantalla tenía la suya: en una el intervalo nuevo nacía con inicio = fin (y el
// día quedaba inválido al instante), en la otra sumaba 1 h y pasadas las 23:00
// daba la vuelta a 00:xx.

export type Intervalo = HorarioDiaDto["intervalos"][number];

export const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Última hora que ofrece el selector (pasos de 30 min). */
export const HORA_MAXIMA = "23:30";

function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/**
 * Intervalo que se agrega después del último: empieza donde terminó el anterior
 * y dura 1 h, sin pasar de `maximo`. `null` si ya no cabe ninguno ese día.
 */
export function siguienteIntervalo(
  intervalos: Intervalo[],
  maximo: string = HORA_MAXIMA,
  inicioPorDefecto = "09:00",
): Intervalo | null {
  const inicio = intervalos.at(-1)?.horaFin ?? inicioPorDefecto;
  const tope = Math.min(aMinutos(maximo), aMinutos(HORA_MAXIMA));
  if (aMinutos(inicio) >= tope) return null;
  return { horaInicio: inicio, horaFin: aHora(Math.min(aMinutos(inicio) + 60, tope)) };
}

/** Qué está mal en el día, con el número de intervalo; `null` si se puede guardar. */
export function errorDelDia(dia: HorarioDiaDto): string | null {
  if (!dia.activo) return null;
  for (let i = 0; i < dia.intervalos.length; i++) {
    const iv = dia.intervalos[i];
    if (!iv.horaInicio || !iv.horaFin || iv.horaInicio >= iv.horaFin) {
      return dia.intervalos.length > 1
        ? `Intervalo ${i + 1}: la hora de fin debe ser posterior a la de inicio.`
        : "La hora de fin debe ser posterior a la de inicio.";
    }
  }
  for (let i = 0; i < dia.intervalos.length - 1; i++) {
    if (dia.intervalos[i].horaFin > dia.intervalos[i + 1].horaInicio) {
      return `El intervalo ${i + 2} empieza antes de que termine el ${i + 1}.`;
    }
  }
  return null;
}

/** Copia los intervalos de un día a todos los demás días abiertos. */
export function aplicarATodosLosAbiertos(horarios: HorarioDiaDto[], diaOrigen: number): HorarioDiaDto[] {
  const origen = horarios.find((h) => h.diaSemana === diaOrigen);
  if (!origen) return horarios;
  return horarios.map((h) =>
    h.diaSemana === diaOrigen || !h.activo
      ? h
      : { ...h, intervalos: origen.intervalos.map((iv) => ({ ...iv })) },
  );
}

/** "09:00" → "9:00 a.m." */
export function horaLegible(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
}
