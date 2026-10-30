import { describe, it, expect } from "vitest";
import { asignarCarriles, dentroDelRango, ocupaAgenda, rangoHoras } from "./carrilesCitas";

// Horas locales: la rejilla se dibuja en la zona horaria del navegador.
const local = (h: number, m = 0) => new Date(2026, 9, 20, h, m).toISOString();
const cita = (id: string, h: number, m: number, dur: number) => ({ id, inicioEn: local(h, m), duracionMinutos: dur });

describe("asignarCarriles", () => {
  it("una cita sola ocupa todo el ancho", () => {
    expect(asignarCarriles([cita("a", 10, 0, 30)]).get("a")).toEqual({ carril: 0, carriles: 1 });
  });

  it("dos citas a la misma hora quedan lado a lado", () => {
    const r = asignarCarriles([cita("a", 10, 0, 60), cita("b", 10, 0, 30)]);
    expect(r.get("a")?.carriles).toBe(2);
    expect(r.get("b")?.carriles).toBe(2);
    expect(new Set([r.get("a")?.carril, r.get("b")?.carril])).toEqual(new Set([0, 1]));
  });

  it("una cita que empieza cuando otra termina reutiliza la columna", () => {
    const r = asignarCarriles([cita("a", 10, 0, 30), cita("b", 10, 30, 30)]);
    expect(r.get("a")).toEqual({ carril: 0, carriles: 1 });
    expect(r.get("b")).toEqual({ carril: 0, carriles: 1 });
  });

  it("los solapes encadenados comparten el número de columnas del grupo", () => {
    // a 10:00–11:00, b 10:30–11:30, c 11:00–12:00 → c puede ir en la columna de a.
    const r = asignarCarriles([cita("a", 10, 0, 60), cita("b", 10, 30, 60), cita("c", 11, 0, 60)]);
    expect(r.get("a")).toEqual({ carril: 0, carriles: 2 });
    expect(r.get("b")).toEqual({ carril: 1, carriles: 2 });
    expect(r.get("c")).toEqual({ carril: 0, carriles: 2 });
  });

  it("dos citas encimadas reciben columnas y anchos distintos, sin taparse", () => {
    const r = asignarCarriles([cita("a", 16, 0, 60), cita("b", 16, 0, 45)]);
    const a = r.get("a")!, b = r.get("b")!;
    expect(a.carril).not.toBe(b.carril);
    expect(a.carriles).toBe(2);
    // Cada una ocupa su mitad: ninguna se estira sobre la otra.
    expect(a.ancho ?? 1).toBe(1);
    expect(b.ancho ?? 1).toBe(1);
  });

  it("una cita se estira sobre las columnas vecinas libres durante su horario", () => {
    // a 16:00–18:00 y b 16:00–16:30 abren dos columnas; c 17:00–17:30 cae en la
    // columna de b (libre desde 16:30). a no se estira: b y c ocupan la vecina.
    const r = asignarCarriles([
      cita("a", 16, 0, 120), cita("b", 16, 0, 30), cita("c", 17, 0, 30), cita("x", 18, 0, 30),
    ]);
    expect(r.get("a")).toEqual({ carril: 0, carriles: 2 });
    expect(r.get("c")).toEqual({ carril: 1, carriles: 2 });
    // x empieza cuando a termina: grupo nuevo a todo el ancho.
    expect(r.get("x")).toEqual({ carril: 0, carriles: 1 });
  });

  it("con tres columnas, una cita se estira si la de su derecha está libre en su horario", () => {
    // c 10:00–12:00 (col 0), a 10:00–11:00 (col 1), b 10:00–10:30 (col 2).
    // e 11:00–11:30 reutiliza la col 1, y la col 2 ya está libre: ocupa dos.
    const r = asignarCarriles([
      cita("a", 10, 0, 60), cita("b", 10, 0, 30), cita("c", 10, 0, 120), cita("e", 11, 0, 30),
    ]);
    expect(r.get("c")?.carril).toBe(0);
    expect(r.get("e")).toEqual({ carril: 1, carriles: 3, ancho: 2 });
  });
});

describe("rangoHoras", () => {
  it("sin citas fuera de horario usa el rango base", () => {
    expect(rangoHoras([cita("a", 10, 0, 30)])).toEqual({ inicio: 7, fin: 21 });
  });

  it("se amplía para incluir una cita de 6:30 y otra que termina a las 22:15", () => {
    expect(rangoHoras([cita("a", 6, 30, 30), cita("b", 21, 30, 45)])).toEqual({ inicio: 6, fin: 23 });
  });
});

describe("citas que ya no ocupan la agenda (Cancelada, Inasistencia)", () => {
  const conEstado = (id: string, h: number, m: number, dur: number, estadoTexto: string) =>
    ({ ...cita(id, h, m, dur), estadoTexto });

  it("una cancelada que se solapa con una activa no le quita ancho", () => {
    const r = asignarCarriles([
      conEstado("cancelada", 10, 0, 60, "Cancelada"),
      conEstado("activa", 10, 0, 60, "Confirmada"),
    ]);
    expect(r.get("activa")).toEqual({ carril: 0, carriles: 1 });
    expect(r.get("cancelada")).toEqual({ carril: 0, carriles: 1, deFondo: true });
  });

  it("una inasistencia tampoco toma carril; dos activas siguen lado a lado", () => {
    const r = asignarCarriles([
      conEstado("a", 10, 0, 60, "Pendiente"),
      conEstado("x", 10, 0, 60, "Inasistencia"),
      conEstado("b", 10, 30, 30, "Confirmada"),
    ]);
    expect(r.get("a")?.carriles).toBe(2);
    expect(r.get("b")?.carriles).toBe(2);
    expect(r.get("x")?.deFondo).toBe(true);
  });

  it("no amplían las horas visibles", () => {
    expect(rangoHoras([
      conEstado("temprano", 5, 0, 30, "Cancelada"),
      conEstado("tarde", 22, 0, 60, "Inasistencia"),
      conEstado("activa", 10, 0, 30, "Completada"),
    ])).toEqual({ inicio: 7, fin: 21 });
  });

  it("ocupaAgenda y dentroDelRango", () => {
    expect(ocupaAgenda({ estadoTexto: "Cancelada" })).toBe(false);
    expect(ocupaAgenda({ estadoTexto: "Completada" })).toBe(true);
    expect(ocupaAgenda({})).toBe(true);
    expect(dentroDelRango(cita("a", 5, 0, 30), { inicio: 7, fin: 21 })).toBe(false);
    expect(dentroDelRango(cita("b", 6, 30, 60), { inicio: 7, fin: 21 })).toBe(true);
  });
});
