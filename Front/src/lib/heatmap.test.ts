import { describe, expect, it } from "vitest";
import { horasVisiblesHeatmap } from "./heatmap";

const vacia = () => Array.from({ length: 24 }, () => Array(7).fill(0));
const horario = (activo: boolean, horaInicio: string, horaFin: string) => ({
  diaSemana: 1, activo, intervalos: [{ horaInicio, horaFin }],
});

describe("horasVisiblesHeatmap", () => {
  it("recorta a las horas de atención del negocio", () => {
    expect(horasVisiblesHeatmap(vacia(), [horario(true, "09:00", "19:00")])).toEqual(
      [9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    );
  });

  it("amplía el rango si hay citas fuera del horario", () => {
    const m = vacia();
    m[20][3] = 2;
    const horas = horasVisiblesHeatmap(m, [horario(true, "09:00", "12:30")]);
    expect(horas[0]).toBe(9);
    expect(horas.at(-1)).toBe(20);
  });

  it("ignora los días cerrados y sin horarios usa el rango de los datos", () => {
    const m = vacia();
    m[10][0] = 1;
    m[11][0] = 1;
    expect(horasVisiblesHeatmap(m, [horario(false, "06:00", "23:00")])).toEqual([10, 11]);
  });

  it("sin datos ni horarios muestra el día completo", () => {
    expect(horasVisiblesHeatmap(vacia())).toHaveLength(24);
  });
});
