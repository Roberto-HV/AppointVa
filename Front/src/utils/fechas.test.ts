import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rangoAuditoria,
  fechaLocal,
  comoUtc,
  deFechaLocal,
  fechaLargaLocal,
  soloFecha,
  finDelDiaEnZona,
  fechaEnZona,
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

describe("comoUtc", () => {
  it("añade la Z solo cuando el ISO no trae zona", () => {
    expect(comoUtc("2026-10-21T15:00:00")).toBe("2026-10-21T15:00:00Z");
    expect(comoUtc("2026-10-21T15:00:00Z")).toBe("2026-10-21T15:00:00Z");
    expect(comoUtc("2026-10-21T15:00:00-06:00")).toBe("2026-10-21T15:00:00-06:00");
  });
});

describe("fechas locales desde YYYY-MM-DD (OM-19)", () => {
  it("deFechaLocal no se corre un día por la zona horaria", () => {
    const d = deFechaLocal("2026-10-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1]);
  });

  it("fechaLargaLocal muestra el mismo día que se pidió", () => {
    expect(fechaLargaLocal("2026-10-01")).toMatch(/^01 de octubre de 2026$/);
  });

  it("soloFecha quita la hora y conserva el día local", () => {
    const d = soloFecha(new Date(2026, 9, 21, 23, 15).toISOString());
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([21, 0, 0]);
  });
});

describe("finDelDiaEnZona (OM-24)", () => {
  it("el 31 de diciembre en Ciudad de México termina a las 05:59:59 UTC del día siguiente", () => {
    expect(finDelDiaEnZona("2026-12-31", "America/Mexico_City")).toBe("2027-01-01T05:59:59.000Z");
  });

  it("respeta otras zonas, incluido el horario de verano", () => {
    expect(finDelDiaEnZona("2026-07-15", "America/New_York")).toBe("2026-07-16T03:59:59.000Z");
    expect(finDelDiaEnZona("2026-07-15", "UTC")).toBe("2026-07-15T23:59:59.000Z");
  });

  it("con una zona inválida o ausente usa el fin del día local del navegador", () => {
    const esperado = new Date(2026, 6, 15, 23, 59, 59).toISOString();
    expect(finDelDiaEnZona("2026-07-15", "No/Existe")).toBe(esperado);
    expect(finDelDiaEnZona("2026-07-15")).toBe(esperado);
  });
});

describe("fechaEnZona (B16)", () => {
  it("es el inverso de finDelDiaEnZona en la zona del negocio", () => {
    expect(fechaEnZona("2027-01-01T05:59:59", "America/Mexico_City")).toBe("2026-12-31");
    expect(fechaEnZona(finDelDiaEnZona("2026-07-15", "America/Mexico_City"), "America/Mexico_City")).toBe("2026-07-15");
  });

  it("sin zona válida usa el día local del navegador", () => {
    const iso = "2026-10-22T12:00:00Z";
    expect(fechaEnZona(iso, "Zona/Inexistente")).toBe(fechaLocal(new Date(iso)));
    expect(fechaEnZona(iso)).toBe(fechaLocal(new Date(iso)));
  });
});

describe("rangoAuditoria (B24)", () => {
  it("convierte días locales en instantes: desde incluido, hasta = inicio del día siguiente", () => {
    const r = rangoAuditoria("2026-10-10", "2026-10-12");
    expect(r.desde).toBe(new Date(2026, 9, 10).toISOString());
    expect(r.hasta).toBe(new Date(2026, 9, 13).toISOString());
  });

  it("un extremo vacío no se envía; el fin de mes pasa al mes siguiente", () => {
    expect(rangoAuditoria("", "")).toEqual({ desde: undefined, hasta: undefined });
    expect(rangoAuditoria("", "2026-10-31").hasta).toBe(new Date(2026, 10, 1).toISOString());
  });
});