import { describe, it, expect } from "vitest";
import { mensajeError, esErrorTemporal, estadoHttp } from "./errores";

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

describe("mensajeError con ProblemDetails de validación", () => {
  const problema = (errors: Record<string, string[]>) => ({ response: { status: 400, data: { title: "One or more validation errors occurred.", errors } } });

  it("traduce el campo obligatorio que rechazó el modelo", () => {
    expect(mensajeError(problema({ TelefonoCliente: ["The TelefonoCliente field is required."] }), "Falló"))
      .toBe("Falta el teléfono.");
  });

  it("conserva un mensaje propio en español y descarta uno en inglés desconocido", () => {
    expect(mensajeError(problema({ Notas: ["La nota es demasiado larga"] }), "Falló")).toBe("La nota es demasiado larga");
    expect(mensajeError(problema({ Algo: ["The value 'x' is not valid."] }), "Falló")).toBe("Falló");
  });
});

describe("esErrorTemporal", () => {
  it("sin respuesta, 5xx, 408 y 429 son temporales", () => {
    expect(esErrorTemporal(new Error("Network Error"))).toBe(true);
    expect(esErrorTemporal({ response: { status: 500 } })).toBe(true);
    expect(esErrorTemporal({ response: { status: 503 } })).toBe(true);
    expect(esErrorTemporal({ response: { status: 408 } })).toBe(true);
    expect(esErrorTemporal({ response: { status: 429 } })).toBe(true);
  });

  it("los rechazos del servidor (4xx) no lo son", () => {
    expect(esErrorTemporal({ response: { status: 400 } })).toBe(false);
    expect(esErrorTemporal({ response: { status: 404 } })).toBe(false);
    expect(estadoHttp({ response: { status: 404 } })).toBe(404);
  });
});
