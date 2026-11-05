import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ahoraEnZona, cierreDelDia, estadoDeHoy, type CalendarioNegocio } from "./calendarioNegocio";

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

describe("estadoDeHoy", () => {
  it("en pleno turno está abierto y dice a qué hora cierra", () => {
    const estado = estadoDeHoy(calendario, new Date(2026, 9, 20, 12));
    expect(estado).toMatchObject({ abiertoAhora: true, cierraA: "14:00", abreA: null });
    expect(estado.intervalos).toHaveLength(2);
  });

  it("entre turnos está cerrado y dice a qué hora vuelve a abrir", () => {
    expect(estadoDeHoy(calendario, new Date(2026, 9, 20, 14, 30))).toMatchObject({
      abiertoAhora: false,
      cierraA: null,
      abreA: "15:00",
    });
  });

  it("tras el último turno ya no abre más hoy", () => {
    expect(estadoDeHoy(calendario, new Date(2026, 9, 20, 19))).toMatchObject({ abiertoAhora: false, abreA: null });
  });

  it("un día sin turnos o bloqueado no tiene intervalos", () => {
    expect(estadoDeHoy(calendario, new Date(2026, 9, 21, 12)).intervalos).toEqual([]);
    expect(estadoDeHoy(calendario, new Date(2026, 9, 22, 12)).intervalos).toEqual([]);
  });
});

describe("estadoDeHoy con la zona horaria del negocio", () => {
  // Instantes en UTC: el resultado no depende de la zona de la máquina que corre la prueba.
  const cdmx: CalendarioNegocio = { ...calendario, zonaHoraria: "America/Mexico_City" };
  const tokio: CalendarioNegocio = { ...calendario, zonaHoraria: "Asia/Tokyo" };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("abierto en pleno turno, con su hora de cierre", () => {
    // 18:00 UTC = 12:00 del martes 20 en Ciudad de México (UTC-6).
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 18)));
    expect(estadoDeHoy(cdmx)).toMatchObject({ diaSemana: 2, abiertoAhora: true, cierraA: "14:00", abreA: null });
  });

  it("entre dos turnos está cerrado y dice a qué hora abre", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 20, 30))); // 14:30 en CDMX
    expect(estadoDeHoy(cdmx)).toMatchObject({ abiertoAhora: false, cierraA: null, abreA: "15:00" });
  });

  it("tras el último turno queda cerrado por hoy, aunque en UTC ya sea otro día", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 21, 1, 30))); // 19:30 del martes en CDMX
    const estado = estadoDeHoy(cdmx);
    expect(estado).toMatchObject({ diaSemana: 2, abiertoAhora: false, cierraA: null, abreA: null });
    expect(estado.intervalos).toHaveLength(2);
  });

  it("un día bloqueado en la zona del negocio no abre", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 22, 18))); // jueves 22 al mediodía en CDMX
    expect(estadoDeHoy(cdmx)).toMatchObject({ diaSemana: 4, intervalos: [], abiertoAhora: false, abreA: null });
  });

  it("el día de la semana sale de la fecha en la zona, no de la del navegador", () => {
    // 00:30 UTC del martes 20 = 09:30 del martes en Tokio (lunes 19 por la tarde en América).
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 0, 30)));
    expect(estadoDeHoy(tokio)).toMatchObject({ diaSemana: 2, abiertoAhora: false, abreA: "10:00" });

    // 15:30 UTC del martes 20 = 00:30 del miércoles 21 en Tokio: ya no es martes.
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 15, 30)));
    expect(estadoDeHoy(tokio)).toMatchObject({ diaSemana: 3, intervalos: [], abiertoAhora: false });
  });

  it("con una zona inválida usa la hora local", () => {
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    expect(estadoDeHoy({ ...calendario, zonaHoraria: "Zona/Inexistente" })).toMatchObject({
      diaSemana: 2,
      abiertoAhora: true,
      cierraA: "14:00",
    });
  });
});
