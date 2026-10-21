import { describe, expect, it } from "vitest";
import { aplicarATodosLosAbiertos, errorDelDia, horaLegible, siguienteIntervalo } from "./horario";

describe("siguienteIntervalo", () => {
  it("empieza donde terminó el anterior y dura una hora", () => {
    expect(siguienteIntervalo([{ horaInicio: "09:00", horaFin: "14:00" }])).toEqual({ horaInicio: "14:00", horaFin: "15:00" });
  });

  it("sin intervalos parte de las 09:00", () => {
    expect(siguienteIntervalo([])).toEqual({ horaInicio: "09:00", horaFin: "10:00" });
  });

  it("no pasa de medianoche ni del máximo del día", () => {
    expect(siguienteIntervalo([{ horaInicio: "20:00", horaFin: "23:00" }])).toEqual({ horaInicio: "23:00", horaFin: "23:30" });
    expect(siguienteIntervalo([{ horaInicio: "09:00", horaFin: "18:30" }], "19:00")).toEqual({ horaInicio: "18:30", horaFin: "19:00" });
  });

  it("devuelve null si ya no cabe otro intervalo", () => {
    expect(siguienteIntervalo([{ horaInicio: "09:00", horaFin: "23:30" }])).toBeNull();
    expect(siguienteIntervalo([{ horaInicio: "09:00", horaFin: "19:00" }], "19:00")).toBeNull();
  });
});

describe("errorDelDia", () => {
  const dia = (intervalos: { horaInicio: string; horaFin: string }[], activo = true) => ({ diaSemana: 1, activo, intervalos });

  it("un día válido o cerrado no tiene error", () => {
    expect(errorDelDia(dia([{ horaInicio: "09:00", horaFin: "14:00" }, { horaInicio: "15:00", horaFin: "19:00" }]))).toBeNull();
    expect(errorDelDia(dia([{ horaInicio: "10:00", horaFin: "09:00" }], false))).toBeNull();
  });

  it("nombra el intervalo con el fin antes del inicio", () => {
    expect(errorDelDia(dia([{ horaInicio: "09:00", horaFin: "14:00" }, { horaInicio: "16:00", horaFin: "15:00" }])))
      .toBe("Intervalo 2: la hora de fin debe ser posterior a la de inicio.");
  });

  it("nombra los intervalos que se solapan", () => {
    expect(errorDelDia(dia([{ horaInicio: "09:00", horaFin: "14:00" }, { horaInicio: "13:00", horaFin: "15:00" }])))
      .toBe("El intervalo 2 empieza antes de que termine el 1.");
  });
});

describe("aplicarATodosLosAbiertos", () => {
  it("copia los intervalos solo a los días abiertos", () => {
    const horarios = [
      { diaSemana: 0, activo: false, intervalos: [] },
      { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "14:00" }, { horaInicio: "15:00", horaFin: "19:00" }] },
      { diaSemana: 2, activo: true, intervalos: [{ horaInicio: "10:00", horaFin: "12:00" }] },
    ];
    const r = aplicarATodosLosAbiertos(horarios, 1);
    expect(r[0].intervalos).toEqual([]);
    expect(r[2].intervalos).toEqual(horarios[1].intervalos);
    expect(r[2].intervalos).not.toBe(horarios[1].intervalos);
  });
});

it("horaLegible usa 12 horas", () => {
  expect(horaLegible("00:30")).toBe("12:30 a.m.");
  expect(horaLegible("13:00")).toBe("1:00 p.m.");
});
