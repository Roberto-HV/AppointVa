import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  BLOQUEO_SALIDA_MS,
  formatoCuentaAtras,
  leerBloqueoSalida,
  limpiarBloqueoSalida,
  registrarFalloSalida,
} from "./bloqueoSalidaKiosco";

beforeEach(() => {
  sessionStorage.clear();
  limpiarBloqueoSalida();
});
afterEach(() => vi.restoreAllMocks());

describe("bloqueoSalidaKiosco", () => {
  it("bloquea al tercer fallo y el bloqueo vencido empieza de cero", () => {
    const t0 = 1_000_000;
    expect(registrarFalloSalida(t0).bloqueadoHasta).toBe(0);
    expect(registrarFalloSalida(t0).bloqueadoHasta).toBe(0);
    expect(registrarFalloSalida(t0)).toEqual({ intentos: 3, bloqueadoHasta: t0 + BLOQUEO_SALIDA_MS });
    expect(leerBloqueoSalida(t0 + BLOQUEO_SALIDA_MS - 1).bloqueadoHasta).toBe(t0 + BLOQUEO_SALIDA_MS);
    expect(leerBloqueoSalida(t0 + BLOQUEO_SALIDA_MS)).toEqual({ intentos: 0, bloqueadoHasta: 0 });
  });

  it("limpiar borra los intentos y un valor corrupto se ignora", () => {
    registrarFalloSalida();
    limpiarBloqueoSalida();
    expect(leerBloqueoSalida().intentos).toBe(0);
    sessionStorage.setItem("kiosco-salida-bloqueo", "{no json");
    expect(leerBloqueoSalida()).toEqual({ intentos: 0, bloqueadoHasta: 0 });
  });

  it("sigue limitando en memoria si sessionStorage no está disponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const t0 = 2_000_000;
    registrarFalloSalida(t0);
    registrarFalloSalida(t0);
    expect(registrarFalloSalida(t0)).toEqual({ intentos: 3, bloqueadoHasta: t0 + BLOQUEO_SALIDA_MS });
    expect(leerBloqueoSalida(t0 + 1).bloqueadoHasta).toBe(t0 + BLOQUEO_SALIDA_MS);
  });

  it("si se puede leer pero dejan de funcionar las escrituras, manda la memoria", () => {
    const t0 = 3_000_000;
    registrarFalloSalida(t0); // este sí queda en sessionStorage
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cuota"); });
    registrarFalloSalida(t0);
    expect(registrarFalloSalida(t0)).toEqual({ intentos: 3, bloqueadoHasta: t0 + BLOQUEO_SALIDA_MS });
    expect(leerBloqueoSalida(t0 + 1).bloqueadoHasta).toBe(t0 + BLOQUEO_SALIDA_MS);
  });

  it("formatea la cuenta atrás en m:ss", () => {
    expect(formatoCuentaAtras(BLOQUEO_SALIDA_MS)).toBe("5:00");
    expect(formatoCuentaAtras(64_001)).toBe("1:05");
    expect(formatoCuentaAtras(-5)).toBe("0:00");
  });
});
