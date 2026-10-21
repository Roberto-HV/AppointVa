import { describe, it, expect } from "vitest";
import { mensajeError } from "./errores";

describe("mensajeError", () => {
  it("devuelve el mensaje del backend", () => {
    expect(mensajeError({ response: { data: { mensaje: "Horario ocupado" } } }, "Falló")).toBe("Horario ocupado");
  });

  it("usa el texto por defecto sin respuesta, con mensaje vacío o con un tipo raro", () => {
    expect(mensajeError(new Error("red"), "Falló")).toBe("Falló");
    expect(mensajeError(undefined, "Falló")).toBe("Falló");
    expect(mensajeError({ response: { data: { mensaje: "  " } } }, "Falló")).toBe("Falló");
    expect(mensajeError({ response: { data: { mensaje: 42 } } }, "Falló")).toBe("Falló");
  });
});
