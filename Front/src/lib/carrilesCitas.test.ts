import { describe, it, expect } from "vitest";
import { asignarCarriles, rangoHoras } from "./carrilesCitas";

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
});

describe("rangoHoras", () => {
  it("sin citas fuera de horario usa el rango base", () => {
    expect(rangoHoras([cita("a", 10, 0, 30)])).toEqual({ inicio: 7, fin: 21 });
  });

  it("se amplía para incluir una cita de 6:30 y otra que termina a las 22:15", () => {
    expect(rangoHoras([cita("a", 6, 30, 30), cita("b", 21, 30, 45)])).toEqual({ inicio: 6, fin: 23 });
  });
});
