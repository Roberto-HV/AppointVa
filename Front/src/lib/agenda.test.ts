import { describe, it, expect } from "vitest";
import {
  bandasFueraDeHorario, diaCerrado, horaDeDesplazamiento, instanteEnRejilla, motivoHuecoBloqueado, rangoDelHorario,
} from "./agenda";
import type { HorarioDiaDto } from "../types";

// Lunes a sábado de 9:00 a 14:00 y de 15:00 a 20:00; domingo cerrado.
const horarios: HorarioDiaDto[] = Array.from({ length: 7 }, (_, dia) => ({
  diaSemana: dia,
  activo: dia !== 0,
  intervalos: dia === 0 ? [] : [{ horaInicio: "09:00", horaFin: "14:00" }, { horaInicio: "15:00", horaFin: "20:00" }],
}));
const lunes = new Date(2030, 0, 7);
const domingo = new Date(2030, 0, 13);
const ahora = new Date(2030, 0, 7, 12, 10);

describe("motivoHuecoBloqueado", () => {
  it("un hueco libre, futuro y dentro del horario se puede agendar", () => {
    expect(motivoHuecoBloqueado(new Date(2030, 0, 8, 16, 0), horarios, [], ahora)).toBeNull();
  });

  it("no deja agendar en el pasado, ni en el hueco que ya empezó", () => {
    expect(motivoHuecoBloqueado(new Date(2030, 0, 7, 10, 0), horarios, [], ahora)).toBe("pasado");
    expect(motivoHuecoBloqueado(new Date(2030, 0, 7, 12, 0), horarios, [], ahora)).toBe("pasado");
  });

  it("no deja agendar en un día cerrado ni en uno bloqueado", () => {
    expect(motivoHuecoBloqueado(new Date(2030, 0, 13, 10, 0), horarios, [], ahora)).toBe("cerrado");
    expect(motivoHuecoBloqueado(new Date(2030, 0, 9, 10, 0), horarios, [{ id: "b", fecha: "2030-01-09" }], ahora)).toBe("cerrado");
  });

  it("no deja agendar en la comida ni después del cierre", () => {
    expect(motivoHuecoBloqueado(new Date(2030, 0, 8, 14, 30), horarios, [], ahora)).toBe("fueraDeHorario");
    expect(motivoHuecoBloqueado(new Date(2030, 0, 8, 20, 0), horarios, [], ahora)).toBe("fueraDeHorario");
  });

  it("sin horarios cargados solo bloquea el pasado", () => {
    expect(motivoHuecoBloqueado(new Date(2030, 0, 13, 22, 0), undefined, undefined, ahora)).toBeNull();
  });
});

describe("rejilla", () => {
  it("ajusta el clic al cuarto de hora anterior", () => {
    // 9:00 + 7h15 → 16:15 (64px por hora, clic a mitad del cuarto).
    expect(instanteEnRejilla(lunes, 64 * 7 + 20, 9, 64)).toEqual(new Date(2030, 0, 7, 16, 15));
  });

  it("las horas visibles salen del horario del negocio", () => {
    expect(rangoDelHorario(horarios)).toEqual([9, 20]);
    expect(rangoDelHorario(undefined)).toEqual([7, 21]);
  });

  it("sombrea lo que queda fuera del horario, y el día cerrado entero", () => {
    expect(bandasFueraDeHorario(lunes, horarios, [], { inicio: 8, fin: 21 })).toEqual([[8, 9], [14, 15], [20, 21]]);
    expect(bandasFueraDeHorario(domingo, horarios, [], { inicio: 8, fin: 21 })).toEqual([[8, 21]]);
    expect(diaCerrado(domingo, horarios, [])).toBe(true);
  });
});

describe("horaDeDesplazamiento", () => {
  it("con hoy en pantalla, abre una hora antes de la actual", () => {
    expect(horaDeDesplazamiento([lunes], horarios, [], null, ahora)).toBe(11);
  });

  it("en otra semana, abre una hora antes de la apertura del primer día abierto", () => {
    const semanaQueViene = [new Date(2030, 0, 13), new Date(2030, 0, 14)];
    expect(horaDeDesplazamiento(semanaQueViene, horarios, [], null, ahora)).toBe(8);
  });

  it("sin horario, va a la primera cita", () => {
    expect(horaDeDesplazamiento([new Date(2030, 0, 20)], undefined, [], new Date(2030, 0, 20, 17, 30), ahora)).toBe(16);
  });
});
