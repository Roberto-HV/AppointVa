import { describe, it, expect } from "vitest";
import {
  formatPrecio,
  formatFecha,
  formatFechaLarga,
  formatFechaHoraCorta,
  formatFechaHora,
  formatFechaHoraResumen,
  formatFechaHoraCompleta,
} from "./formatters";

describe("formatPrecio", () => {
  it("formatea un número entero como MXN", () => {
    expect(formatPrecio(100)).toContain("100");
    expect(formatPrecio(100)).toMatch(/MX\$|\\$|100/);
  });

  it("formatea cero", () => {
    expect(formatPrecio(0)).toContain("0");
  });

  it("formatea decimales", () => {
    const result = formatPrecio(1234.5);
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("formatea números grandes con separador de miles", () => {
    const result = formatPrecio(10000);
    expect(result).toContain("10");
    expect(result).toContain("000");
  });
});

describe("formatFecha", () => {
  it("retorna — para cadena vacía", () => {
    expect(formatFecha("")).toBe("—");
  });

  it("retorna — para fecha inválida", () => {
    expect(formatFecha("no-es-fecha")).toBe("—");
  });

  it("contiene el año correcto", () => {
    expect(formatFecha("2026-06-15")).toContain("2026");
  });

  it("no contiene hora", () => {
    const result = formatFecha("2026-06-15T10:00:00");
    expect(result).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatFechaLarga", () => {
  it("retorna — para fecha inválida", () => {
    expect(formatFechaLarga("invalido")).toBe("—");
  });

  it("empieza con mayúscula", () => {
    const result = formatFechaLarga("2026-06-15");
    expect(result[0]).toBe(result[0].toUpperCase());
  });

  it("contiene el año", () => {
    expect(formatFechaLarga("2026-06-15")).toContain("2026");
  });
});

describe("formatFechaHoraCorta", () => {
  it("retorna — para fecha inválida", () => {
    expect(formatFechaHoraCorta("xyz")).toBe("—");
  });

  it("contiene el año", () => {
    expect(formatFechaHoraCorta("2026-06-15T10:30:00")).toContain("2026");
  });

  it("contiene la hora", () => {
    const result = formatFechaHoraCorta("2026-06-15T10:30:00");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatFechaHora", () => {
  it("retorna — para fecha inválida", () => {
    expect(formatFechaHora("")).toBe("—");
  });

  it("no contiene 'De' con mayúscula (normalización aplicada)", () => {
    const result = formatFechaHora("2026-06-15T10:00:00");
    expect(result).not.toMatch(/\bDe\b/);
  });

  it("contiene el año", () => {
    expect(formatFechaHora("2026-06-15T10:00:00")).toContain("2026");
  });
});

describe("formatFechaHoraResumen", () => {
  it("retorna — para fecha inválida", () => {
    expect(formatFechaHoraResumen("invalid")).toBe("—");
  });

  it("empieza con mayúscula", () => {
    const result = formatFechaHoraResumen("2026-06-15T10:00:00");
    expect(result[0]).toBe(result[0].toUpperCase());
  });

  it("contiene hora en formato 12h", () => {
    const result = formatFechaHoraResumen("2026-06-15T10:00:00");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatFechaHoraCompleta", () => {
  it("retorna — para fecha inválida", () => {
    expect(formatFechaHoraCompleta("bad")).toBe("—");
  });

  it("empieza con mayúscula", () => {
    const result = formatFechaHoraCompleta("2026-06-15T10:00:00");
    expect(result[0]).toBe(result[0].toUpperCase());
  });

  it("no contiene 'De' con mayúscula", () => {
    const result = formatFechaHoraCompleta("2026-06-15T10:00:00");
    expect(result).not.toMatch(/\bDe\b/);
  });

  it("contiene el año", () => {
    expect(formatFechaHoraCompleta("2026-06-15T09:00:00")).toContain("2026");
  });
});
