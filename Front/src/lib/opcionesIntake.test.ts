import { describe, expect, it } from "vitest";
import { leerOpciones, serializarOpciones } from "./opcionesIntake";

describe("opciones del cuestionario (OM-25)", () => {
  it("una opción con coma sobrevive al guardar y leer", () => {
    const raw = serializarOpciones(["Sí, pero leve", "No"]);
    expect(raw).toBe('["Sí, pero leve","No"]');
    expect(leerOpciones(raw)).toEqual(["Sí, pero leve", "No"]);
  });

  it("sigue leyendo las preguntas antiguas separadas por coma", () => {
    expect(leerOpciones("Sí, No, Tal vez")).toEqual(["Sí", "No", "Tal vez"]);
  });

  it("descarta vacías y repetidas; sin opciones devuelve undefined", () => {
    expect(serializarOpciones([" A ", "", "A", "B"])).toBe('["A","B"]');
    expect(serializarOpciones(["", "  "])).toBeUndefined();
    expect(leerOpciones(null)).toEqual([]);
  });
});
