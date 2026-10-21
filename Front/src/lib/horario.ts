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

/** Parte de `intervalos` que cae dentro de `permitidos`, ordenada. */
export function recortarAIntervalos(intervalos: Intervalo[], permitidos: Intervalo[]): Intervalo[] {
  const resultado: Intervalo[] = [];
  for (const iv of intervalos) {
    for (const p of permitidos) {
      const inicio = iv.horaInicio > p.horaInicio ? iv.horaInicio : p.horaInicio;
      const fin = iv.horaFin < p.horaFin ? iv.horaFin : p.horaFin;
      if (inicio < fin) resultado.push({ horaInicio: inicio, horaFin: fin });
    }
  }
  return resultado.sort((x, y) => x.horaInicio.localeCompare(y.horaInicio));
}

export interface ResultadoAplicar {
  horarios: HorarioDiaDto[];
  /** Días que recibieron la copia completa. */
  copiados: number[];
  /** Días donde la copia se recortó al horario del negocio. */
  recortados: number[];
  /** Días que no cambiaron porque nada de la copia cabe en el horario del negocio. */
  omitidos: number[];
}

/**
 * Copia los intervalos de un día a todos los demás días abiertos.
 *
 * Con `horarioPermitido` (editor de un empleado), cada copia se recorta al
 * horario del negocio de ese día; si no cabe nada (o el negocio cierra), el día
 * se deja como estaba. El resultado dice qué pasó en cada día para avisarlo.
 */
export function aplicarATodosLosAbiertos(
  horarios: HorarioDiaDto[],
  diaOrigen: number,
  horarioPermitido?: (diaSemana: number) => Intervalo[] | null,
): ResultadoAplicar {
  const resultado: ResultadoAplicar = { horarios, copiados: [], recortados: [], omitidos: [] };
  const origen = horarios.find((h) => h.diaSemana === diaOrigen);
  if (!origen) return resultado;

  resultado.horarios = horarios.map((h) => {
    if (h.diaSemana === diaOrigen || !h.activo) return h;
    const copia = origen.intervalos.map((iv) => ({ ...iv }));
    if (!horarioPermitido) {
      resultado.copiados.push(h.diaSemana);
      return { ...h, intervalos: copia };
    }
    const permitidos = horarioPermitido(h.diaSemana);
    const ajustada = permitidos ? recortarAIntervalos(copia, permitidos) : [];
    if (ajustada.length === 0) {
      resultado.omitidos.push(h.diaSemana);
      return h;
    }
    const igual =
      ajustada.length === copia.length &&
      ajustada.every((iv, i) => iv.horaInicio === copia[i].horaInicio && iv.horaFin === copia[i].horaFin);
    (igual ? resultado.copiados : resultado.recortados).push(h.diaSemana);
    return { ...h, intervalos: ajustada };
  });
  return resultado;
}

/** Aviso para el usuario después de aplicar; `null` si todo se copió tal cual. */
export function avisoAplicar({ copiados, recortados, omitidos }: ResultadoAplicar): string | null {
  if (recortados.length === 0 && omitidos.length === 0) return null;
  const nombres = (dias: number[]) => dias.map((d) => DIAS_SEMANA[d]).join(", ");
  const partes: string[] = [];
  if (copiados.length) partes.push(`Copiado a ${nombres(copiados)}.`);
  if (recortados.length) partes.push(`Ajustado al horario del negocio en ${nombres(recortados)}.`);
  if (omitidos.length) partes.push(`Sin cambios en ${nombres(omitidos)}: el horario copiado queda fuera del horario del negocio.`);
  return partes.join(" ");
}

/** "09:00" → "9:00 a.m." */
export function horaLegible(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`;
}
