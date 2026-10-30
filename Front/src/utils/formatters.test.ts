import { describe, it, expect } from "vitest";
import {
  formatPrecio,
  formatPrecioCorto,
  formatFecha,
  formatFechaLarga,
  formatFechaHoraCorta,
  formatFechaHora,
  formatFechaHoraResumen,
  formatFechaHoraCompleta,
  formatFechaMx,
  capitalizarPrimera,
  formatHora,
  formatHoraDe,
  formatHoraEje,
  formatHoraTexto,
  monogramaNegocio,
  formatCuandoCita,
  describirCuandoCita,
} from "./formatters";

// Español: solo la primera letra va en mayúscula; días, meses y "de" no.
describe("capitalizarPrimera", () => {
  it("pone en mayúscula solo la primera letra", () => {
    expect(capitalizarPrimera("miércoles, 21 de octubre")).toBe("Miércoles, 21 de octubre");
  });

  it("no toca el resto de la cadena (no es title case)", () => {
    expect(capitalizarPrimera("sábado, 3 de enero de 2026")).not.toMatch(/De|Enero/);
  });

  it("deja igual una cadena que empieza con número y tolera la cadena vacía", () => {
    expect(capitalizarPrimera("01 oct 2026, 10:00 a. m.")).toBe("01 oct 2026, 10:00 a. m.");
    expect(capitalizarPrimera("")).toBe("");
  });

  it.each([
    ["formatFechaLarga", formatFechaLarga],
    ["formatFechaHoraResumen", formatFechaHoraResumen],
    ["formatFechaHoraCompleta", formatFechaHoraCompleta],
  ])("%s empieza en mayúscula (día de la semana capitalizado)", (_nombre, formatear) => {
    const s = formatear("2026-06-16T10:00:00");
    expect(s.charAt(0)).toBe(s.charAt(0).toLocaleUpperCase("es-MX"));
    expect(s.charAt(0)).not.toBe(s.charAt(0).toLocaleLowerCase("es-MX"));
  });
});

describe("formatPrecioCorto", () => {
  it("usa separador de miles y sin centavos", () => {
    expect(formatPrecioCorto(1250.6)).toBe("$1,251");
  });
  it("compacta desde 10 mil", () => {
    expect(formatPrecioCorto(12345)).toBe("$12k");
  });
});

describe("formatPrecio", () => {
  it("pesos enteros sin centavos: se lee como menú, no como factura", () => {
    expect(formatPrecio(280)).toBe("$280");
    expect(formatPrecio(1250)).toBe("$1,250");
  });

  it("con centavos solo cuando los hay", () => {
    expect(formatPrecio(280.5)).toBe("$280.50");
  });

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

describe("formatFechaMx", () => {
  it("da día/mes/año con ceros, en hora local", () => {
    expect(formatFechaMx("2026-06-05T23:30:00")).toBe("05/06/2026");
  });

  it("devuelve un guion con una fecha inválida", () => {
    expect(formatFechaMx("no-es-fecha")).toBe("—");
  });
});

describe("nombreConInicial (DC-28)", () => {
  it("deja el nombre de pila y la inicial del primer apellido", async () => {
    const { nombreConInicial } = await import("./formatters");
    expect(nombreConInicial("María García López")).toBe("María G.");
    expect(nombreConInicial("  josé   pérez ")).toBe("josé P.");
    expect(nombreConInicial("Ana")).toBe("Ana");
    expect(nombreConInicial("")).toBe("");
    expect(nombreConInicial(null)).toBe("");
  });

  it("salta las partículas del apellido (de, del, la, las, los, y)", async () => {
    const { nombreConInicial } = await import("./formatters");
    expect(nombreConInicial("María de la Cruz")).toBe("María C.");
    expect(nombreConInicial("Pedro del Valle")).toBe("Pedro V.");
    expect(nombreConInicial("Luis De Los Santos")).toBe("Luis S.");
    expect(nombreConInicial("Rosa y Gasset")).toBe("Rosa G.");
    // Solo partículas tras el nombre: queda el nombre de pila.
    expect(nombreConInicial("Ana de")).toBe("Ana");
  });

  it("deja entero el marcador de cliente eliminado", async () => {
    const { nombreConInicial, CLIENTE_ELIMINADO } = await import("./formatters");
    expect(nombreConInicial(CLIENTE_ELIMINADO)).toBe("Cliente eliminado");
  });

  it("limitación conocida: un nombre de pila compuesto toma la segunda palabra como apellido", async () => {
    const { nombreConInicial } = await import("./formatters");
    expect(nombreConInicial("Juan Carlos Pérez")).toBe("Juan C.");
    expect(nombreConInicial("María José de la Torre")).toBe("María J.");
  });
});

describe("formato único de hora", () => {
  it("no pone cero a la izquierda en la hora", () => {
    expect(formatHora("2026-06-15T09:05:00")).toMatch(/^9:05\s?[ap]/);
    expect(formatHoraDe(new Date(2026, 5, 15, 16, 30))).toMatch(/^4:30\s?p/);
  });

  it("los ejes usan el mismo formato, sin minutos", () => {
    expect(formatHoraEje(9)).toMatch(/^9\s?a\.\s?m\.$/);
    expect(formatHoraEje(12)).toMatch(/^12\s?p\.\s?m\.$/);
    expect(formatHoraEje(16)).toMatch(/^4\s?p\.\s?m\.$/);
  });

  it("convierte la hora en texto del API al formato único", () => {
    expect(formatHoraTexto("16:00")).toBe(formatHoraDe(new Date(2026, 0, 1, 16, 0)));
    expect(formatHoraTexto("09:30")).toMatch(/^9:30\s?a/);
    // Lo que no es una hora ("--" sin datos) se deja tal cual.
    expect(formatHoraTexto("--")).toBe("--");
  });

  it("usa el mismo formato en las fechas con hora", () => {
    expect(formatFechaHora("2026-06-15T09:05:00")).toContain(formatHora("2026-06-15T09:05:00"));
    expect(formatFechaHoraCorta("2026-06-15T09:05:00")).not.toMatch(/09:05/);
  });
});

describe("monogramaNegocio", () => {
  it("salta la palabra del giro y toma la distintiva", () => {
    expect(monogramaNegocio("Salón Aramis")).toBe("A");
    expect(monogramaNegocio("Barbería Luis")).toBe("L");
    expect(monogramaNegocio("Clínica Dental Sonrisa")).toBe("D");
    expect(monogramaNegocio("Consultorio de la Dra. Pérez")).toBe("D");
  });

  it("ignora acentos y mayúsculas al reconocer el giro", () => {
    expect(monogramaNegocio("SALON aramis")).toBe("A");
    expect(monogramaNegocio("barberia el Güero")).toBe("G");
  });

  it("usa la primera palabra si todas son genéricas y tolera vacío", () => {
    expect(monogramaNegocio("Salón")).toBe("S");
    expect(monogramaNegocio("Lashes_crisantemo")).toBe("L");
    expect(monogramaNegocio("")).toBe("");
    expect(monogramaNegocio(null)).toBe("");
  });
});

// Titular de la confirmación: "Te esperamos el jueves 22 a las 9:00 a. m."
describe("formatCuandoCita", () => {
  // Miércoles 21 de octubre de 2026, 10:00 hora local.
  const ahora = new Date(2026, 9, 21, 10, 0);
  const iso = (d: Date) => d.toISOString();

  it("dice hoy y mañana en lugar de la fecha", () => {
    expect(formatCuandoCita(iso(new Date(2026, 9, 21, 17, 30)), ahora)).toMatch(/^hoy a las 5:30/);
    expect(formatCuandoCita(iso(new Date(2026, 9, 22, 9, 0)), ahora)).toMatch(/^mañana a las 9:00/);
  });

  it("dentro de la semana nombra el día y su número, sin mes", () => {
    expect(formatCuandoCita(iso(new Date(2026, 9, 23, 9, 0)), ahora)).toMatch(/^el viernes 23 a las 9:00/);
  });

  it("más lejos añade el mes, y el año solo si cambia", () => {
    expect(formatCuandoCita(iso(new Date(2026, 10, 5, 9, 0)), ahora)).toMatch(/^el jueves 5 de noviembre a las 9:00/);
    expect(formatCuandoCita(iso(new Date(2027, 0, 7, 9, 0)), ahora)).toMatch(/^el jueves 7 de enero de 2027 a las 9:00/);
  });

  it("concuerda el artículo con la una", () => {
    expect(formatCuandoCita(iso(new Date(2026, 9, 21, 13, 0)), ahora)).toMatch(/^hoy a la 1:00/);
  });

  it("devuelve vacío con una fecha inválida", () => {
    expect(formatCuandoCita("no-es-fecha", ahora)).toBe("");
  });
});

describe("describirCuandoCita", () => {
  const ahora = new Date(2026, 9, 21, 10, 0);
  const iso = (d: Date) => d.toISOString();

  it("hoy y ya empezada: dias 0 y yaInicio, sin depender del texto", () => {
    expect(describirCuandoCita(iso(new Date(2026, 9, 21, 9, 30)), ahora)).toMatchObject({ dias: 0, yaInicio: true });
  });

  it("hoy más tarde, mañana y días pasados", () => {
    expect(describirCuandoCita(iso(new Date(2026, 9, 21, 17, 0)), ahora)).toMatchObject({ dias: 0, yaInicio: false });
    expect(describirCuandoCita(iso(new Date(2026, 9, 22, 9, 0)), ahora)).toMatchObject({ dias: 1, yaInicio: false });
    expect(describirCuandoCita(iso(new Date(2026, 9, 18, 9, 0)), ahora)).toMatchObject({ dias: -3, yaInicio: true });
  });

  it("devuelve null con una fecha inválida", () => {
    expect(describirCuandoCita("no-es-fecha", ahora)).toBeNull();
  });
});