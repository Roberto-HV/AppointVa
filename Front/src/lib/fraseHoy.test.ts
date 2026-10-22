import { describe, it, expect } from "vitest";
import { fraseDeHoy, saludoDelDia, saludoConNombre, textoFrase, type CitaFrase } from "./fraseHoy";

// Miércoles 21 de octubre de 2026, 15:00 hora local.
const ahora = new Date(2026, 9, 21, 15, 0);

function cita(h: number, m: number, duracion: number, estadoTexto = "Confirmada", extra: Partial<CitaFrase> = {}): CitaFrase {
  const inicio = new Date(2026, 9, 21, h, m);
  return {
    inicioEn: inicio.toISOString(),
    finEn: new Date(inicio.getTime() + duracion * 60_000).toISOString(),
    estadoTexto,
    nombreServicio: "Corte de dama",
    nombreCliente: "Sofía Ramírez",
    ...extra,
  };
}

const frase = (citas: CitaFrase[], terminos?: { cita: string; citas: string }) =>
  textoFrase(fraseDeHoy(citas, ahora, terminos));

describe("saludoDelDia", () => {
  it("cambia a las 12 y a las 19", () => {
    expect(saludoDelDia(new Date(2026, 9, 21, 9))).toBe("Buenos días");
    expect(saludoDelDia(new Date(2026, 9, 21, 12))).toBe("Buenas tardes");
    expect(saludoDelDia(new Date(2026, 9, 21, 19))).toBe("Buenas noches");
  });

  it("sin nombre no deja una coma colgando", () => {
    expect(saludoConNombre("Aramis", ahora)).toBe("Buenas tardes, Aramis.");
    expect(saludoConNombre("", ahora)).toBe("Buenas tardes.");
  });
});

describe("fraseDeHoy", () => {
  it("sin citas: agenda libre", () => {
    expect(frase([])).toBe("Agenda libre hoy.");
  });

  it("las canceladas no cuentan", () => {
    expect(frase([cita(17, 30, 45, "Cancelada")])).toBe("Agenda libre hoy.");
  });

  it("una cita por delante se nombra directo", () => {
    expect(frase([cita(17, 30, 45)])).toMatch(/^Hoy tienes 1 cita: Corte de dama a las 5:30.+ con Sofía\.$/);
  });

  it("varias: cuenta y nombra la siguiente", () => {
    const texto = frase([cita(10, 0, 30, "Completada"), cita(17, 30, 45), cita(18, 30, 30, "Pendiente", { nombreServicio: "Uñas" })]);
    expect(texto).toMatch(/^Hoy tienes 3 citas; la siguiente es Corte de dama a las 5:30.+ con Sofía\.$/);
  });

  it("marca en negritas la cuenta y la siguiente cita", () => {
    const enfasis = fraseDeHoy([cita(17, 30, 45), cita(18, 0, 30)], ahora).filter((t) => t.enfasis).map((t) => t.texto);
    expect(enfasis[0]).toBe("2 citas");
    expect(enfasis[1]).toMatch(/^Corte de dama a las 5:30/);
  });

  it("usa 'a la' para la una", () => {
    const alaUna = textoFrase(fraseDeHoy([cita(13, 0, 30)], new Date(2026, 9, 21, 9)));
    expect(alaUna).toMatch(/Corte de dama a la 1:00/);
  });

  it("si no hay siguiente pero una está en curso, dice a quién atiende", () => {
    expect(frase([cita(10, 0, 30, "Completada"), cita(14, 45, 60)])).toBe("Hoy tienes 2 citas; ahora atiendes Corte de dama con Sofía.");
  });

  it("todo hecho: lo dice en pasado", () => {
    expect(frase([cita(9, 0, 30, "Completada"), cita(11, 0, 30, "Completada")])).toBe("Hoy tuviste 2 citas y ya no quedan más.");
    expect(frase([cita(9, 0, 30, "Completada")])).toBe("Hoy tuviste 1 cita y ya no quedan más.");
  });

  it("usa los términos del sector", () => {
    expect(frase([cita(17, 30, 45)], { cita: "consulta", citas: "consultas" })).toMatch(/^Hoy tienes 1 consulta:/);
  });

  it("sin nombre de cliente omite el 'con'", () => {
    expect(frase([cita(17, 30, 45, "Confirmada", { nombreCliente: "" })])).toMatch(/5:30.+\.$/);
    expect(frase([cita(17, 30, 45, "Confirmada", { nombreCliente: "" })])).not.toMatch(/ con /);
  });
});

describe("fraseDeHoy — la siguiente es mañana", () => {
  const proxima = (dia: number, h: number, estadoTexto = "Confirmada") => ({
    inicioEn: new Date(2026, 9, dia, h, 0).toISOString(),
    estadoTexto,
  });
  const conProximas = (citas: CitaFrase[], proximas: { inicioEn: string; estadoTexto: string }[]) =>
    textoFrase(fraseDeHoy(citas, ahora, undefined, proximas));

  it("agenda libre hoy y una mañana dentro de 24 h: la anuncia", () => {
    expect(conProximas([], [proxima(22, 8)])).toMatch(/^Agenda libre hoy; la siguiente es mañana a las 8:00.+\.$/);
  });

  it("marca en negritas el cuándo", () => {
    const trozos = fraseDeHoy([], ahora, undefined, [proxima(22, 8)]);
    expect(trozos.find((t) => t.enfasis)?.texto).toMatch(/^mañana a las 8:00/);
  });

  it("todo hecho hoy y otra mañana: lo suma al pasado", () => {
    expect(conProximas([cita(9, 0, 30, "Completada")], [proxima(22, 9)])).toMatch(
      /^Hoy tuviste 1 cita y ya no quedan más; la siguiente es mañana a las 9:00/,
    );
  });

  it("más allá de 24 h, cancelada o pasado mañana: no dice nada extra", () => {
    expect(conProximas([], [proxima(22, 16)])).toBe("Agenda libre hoy.");
    expect(conProximas([], [proxima(22, 8, "Cancelada")])).toBe("Agenda libre hoy.");
    expect(conProximas([], [proxima(23, 8)])).toBe("Agenda libre hoy.");
  });

  it("con citas por delante hoy no la menciona", () => {
    expect(conProximas([cita(17, 30, 45)], [proxima(22, 8)])).not.toMatch(/mañana/);
  });
});
