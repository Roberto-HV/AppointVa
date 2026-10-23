import { describe, it, expect } from "vitest";
import { ahoraEnZona, cierreDelDia, type CalendarioNegocio } from "./calendarioNegocio";

const calendario: CalendarioNegocio = {
  // Martes: 10–14 y 15–19. Miércoles: sin intervalos (cerrado).
  horario: [
    { diaSemana: 2, horaInicio: "10:00", horaFin: "14:00" },
    { diaSemana: 2, horaInicio: "15:00", horaFin: "19:00" },
    { diaSemana: 4, horaInicio: "09:00", horaFin: "18:00" },
  ],
  diasCerrados: ["2026-10-22"],
  zonaHoraria: null,
};

describe("cierreDelDia", () => {
  const martes12 = new Date(2026, 9, 20, 12);

  it("un día de la semana sin intervalos está cerrado", () => {
    expect(cierreDelDia("2026-10-21", calendario, martes12)).toBe("cerrado");
  });

  it("un día bloqueado está cerrado aunque su día de la semana abra", () => {
    expect(cierreDelDia("2026-10-22", calendario, martes12)).toBe("cerrado");
  });

  it("un día que abre no está cerrado", () => {
    expect(cierreDelDia("2026-10-27", calendario, martes12)).toBeNull();
  });

  it("hoy cuenta como cerrado solo desde la hora de cierre del último intervalo", () => {
    expect(cierreDelDia("2026-10-20", calendario, new Date(2026, 9, 20, 14, 30))).toBeNull();
    expect(cierreDelDia("2026-10-20", calendario, new Date(2026, 9, 20, 18, 59))).toBeNull();
    expect(cierreDelDia("2026-10-20", calendario, new Date(2026, 9, 20, 19, 0))).toBe("cerrado-hoy");
  });

  it("usa la fecha y hora de la zona del negocio", () => {
    // 01:30 UTC del miércoles 21 = 19:30 del martes 20 en Ciudad de México (UTC-6).
    const ahora = new Date(Date.UTC(2026, 9, 21, 1, 30));
    expect(cierreDelDia("2026-10-20", { ...calendario, zonaHoraria: "America/Mexico_City" }, ahora)).toBe("cerrado-hoy");
  });
});

describe("ahoraEnZona", () => {
  it("convierte a la zona IANA indicada", () => {
    expect(ahoraEnZona(new Date(Date.UTC(2026, 9, 21, 2, 30)), "America/Mexico_City")).toEqual({
      fecha: "2026-10-20",
      minutos: 20 * 60 + 30,
    });
  });

  it("con una zona desconocida usa la hora local", () => {
    const ahora = new Date(2026, 9, 20, 8, 15);
    expect(ahoraEnZona(ahora, "Zona/Inexistente")).toEqual({ fecha: "2026-10-20", minutos: 8 * 60 + 15 });
  });
});
