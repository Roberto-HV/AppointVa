import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fechaLocal,
  hoy,
  inicioSemana,
  finSemana,
  inicioMes,
  finMes,
  inicioAnio,
  finAnio,
} from "./fechas";

/**
 * Implementación rota que vivía duplicada en ReportesPage y PagosPage.
 * Se conserva aquí solo para demostrar la divergencia que provocaba.
 */
function hoyEnUtc(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Instante en el que la fecha local y la fecha UTC NO coinciden, sea cual sea la
 * zona del runner: al oeste de UTC (México incluido) basta con la noche; al este,
 * con la madrugada. En un runner exactamente en UTC no existe tal instante.
 */
function instanteQueDivergeDeUtc(anio: number, mes: number, dia: number): Date {
  const offsetMin = new Date(anio, mes, dia).getTimezoneOffset();
  const hora = offsetMin > 0 ? 22 : 1;
  return new Date(anio, mes, dia, hora, 30, 0);
}

const runnerEnUtc = new Date(2026, 2, 15).getTimezoneOffset() === 0;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fechaLocal", () => {
  it("formatea con ceros a la izquierda", () => {
    expect(fechaLocal(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });

  it("usa los getters locales, no los UTC", () => {
    const nocheDel15 = instanteQueDivergeDeUtc(2026, 2, 15);
    expect(fechaLocal(nocheDel15)).toBe("2026-03-15");
    if (!runnerEnUtc) {
      expect(hoyEnUtc(nocheDel15)).not.toBe("2026-03-15");
    }
  });
});

describe("hoy", () => {
  it("devuelve la fecha local a media mañana", () => {
    vi.setSystemTime(new Date(2026, 2, 18, 10, 0));
    expect(hoy()).toBe("2026-03-18");
  });

  // Regresión del bug real: ReportesPage/PagosPage usaban toISOString() y a partir
  // de las 18:00 en México devolvían el día siguiente, dejando "Hoy" en blanco.
  it("no salta al día siguiente por la noche", () => {
    const noche = instanteQueDivergeDeUtc(2026, 2, 18);
    vi.setSystemTime(noche);
    expect(hoy()).toBe("2026-03-18");
    if (!runnerEnUtc) {
      expect(hoy()).not.toBe(hoyEnUtc(noche));
    }
  });

  it("no salta al día siguiente a las 18:00 en punto", () => {
    vi.setSystemTime(new Date(2026, 2, 18, 18, 0));
    expect(hoy()).toBe("2026-03-18");
  });

  it("no salta de mes en el último día por la noche", () => {
    const noche = instanteQueDivergeDeUtc(2026, 2, 31);
    vi.setSystemTime(noche);
    expect(hoy()).toBe("2026-03-31");
  });
});

describe("inicioSemana / finSemana", () => {
  it("la semana va de lunes a domingo (miércoles)", () => {
    vi.setSystemTime(new Date(2026, 2, 18, 11, 0)); // miércoles
    expect(inicioSemana()).toBe("2026-03-16");
    expect(finSemana()).toBe("2026-03-22");
  });

  it("el domingo cierra su propia semana, no abre la siguiente", () => {
    vi.setSystemTime(new Date(2026, 2, 15, 11, 0)); // domingo
    expect(inicioSemana()).toBe("2026-03-09");
    expect(finSemana()).toBe("2026-03-15");
  });

  it("el lunes es su propio inicio de semana", () => {
    vi.setSystemTime(new Date(2026, 2, 16, 11, 0)); // lunes
    expect(inicioSemana()).toBe("2026-03-16");
    expect(finSemana()).toBe("2026-03-22");
  });

  it("no se corre un día por la noche", () => {
    vi.setSystemTime(instanteQueDivergeDeUtc(2026, 2, 18));
    expect(inicioSemana()).toBe("2026-03-16");
    expect(finSemana()).toBe("2026-03-22");
  });

  it("cruza el cambio de mes hacia atrás", () => {
    vi.setSystemTime(new Date(2026, 3, 1, 11, 0)); // miércoles 1 de abril
    expect(inicioSemana()).toBe("2026-03-30");
    expect(finSemana()).toBe("2026-04-05");
  });
});

describe("inicioMes / finMes", () => {
  it("cubre el mes completo", () => {
    vi.setSystemTime(new Date(2026, 2, 18, 11, 0));
    expect(inicioMes()).toBe("2026-03-01");
    expect(finMes()).toBe("2026-03-31");
  });

  it("resuelve febrero de un año no bisiesto", () => {
    vi.setSystemTime(new Date(2026, 1, 10, 11, 0));
    expect(finMes()).toBe("2026-02-28");
  });

  it("resuelve febrero de un año bisiesto", () => {
    vi.setSystemTime(new Date(2028, 1, 10, 11, 0));
    expect(finMes()).toBe("2028-02-29");
  });

  it("no se corre un día por la noche del último día del mes", () => {
    vi.setSystemTime(instanteQueDivergeDeUtc(2026, 2, 31));
    expect(inicioMes()).toBe("2026-03-01");
    expect(finMes()).toBe("2026-03-31");
  });

  it("no adelanta el mes la noche del 31 de diciembre", () => {
    vi.setSystemTime(instanteQueDivergeDeUtc(2026, 11, 31));
    expect(inicioMes()).toBe("2026-12-01");
    expect(finMes()).toBe("2026-12-31");
  });
});

describe("inicioAnio / finAnio", () => {
  it("cubre el año completo", () => {
    vi.setSystemTime(new Date(2026, 6, 4, 11, 0));
    expect(inicioAnio()).toBe("2026-01-01");
    expect(finAnio()).toBe("2026-12-31");
  });

  it("no adelanta el año la noche del 31 de diciembre", () => {
    vi.setSystemTime(instanteQueDivergeDeUtc(2026, 11, 31));
    expect(inicioAnio()).toBe("2026-01-01");
    expect(finAnio()).toBe("2026-12-31");
  });
});

describe("orden de los rangos", () => {
  it("desde nunca es mayor que hasta", () => {
    for (const dia of [1, 15, 28, 31]) {
      vi.setSystemTime(new Date(2026, 2, dia, 20, 0));
      expect(inicioSemana() <= finSemana()).toBe(true);
      expect(inicioMes() <= hoy()).toBe(true);
      expect(hoy() <= finMes()).toBe(true);
    }
  });
});
