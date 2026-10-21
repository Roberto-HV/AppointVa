import type { HorarioDiaDto } from "../types";

/**
 * Horas (0–23) que muestra el mapa de calor: del primer al último horario de
 * atención de la semana, ampliado si hay citas fuera de él (nunca se esconde un
 * dato). Antes siempre pintaba 24 filas, casi todas vacías, para un negocio de
 * 09:00 a 19:00.
 */
export function horasVisiblesHeatmap(matriz: number[][], horarios: HorarioDiaDto[] = []): number[] {
  let inicio = 24;
  let fin = -1;

  for (const dia of horarios) {
    if (!dia.activo) continue;
    for (const iv of dia.intervalos) {
      const hIni = Number(iv.horaInicio.slice(0, 2));
      const [hFin, mFin] = iv.horaFin.split(":").map(Number);
      // "19:00" termina en la fila de las 18; "19:30" ocupa también la de las 19.
      const ultima = mFin > 0 ? hFin : hFin - 1;
      if (Number.isFinite(hIni)) inicio = Math.min(inicio, hIni);
      if (Number.isFinite(ultima)) fin = Math.max(fin, ultima);
    }
  }

  matriz.forEach((fila, hora) => {
    if (fila?.some((v) => v > 0)) {
      inicio = Math.min(inicio, hora);
      fin = Math.max(fin, hora);
    }
  });

  if (fin < inicio) return Array.from({ length: 24 }, (_, h) => h);
  return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
}
