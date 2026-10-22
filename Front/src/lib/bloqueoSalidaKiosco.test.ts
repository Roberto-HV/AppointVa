import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatoCuentaAtras,
  leerBloqueoSalida,
  limpiarBloqueoSalida,
  registrarBloqueoSalida,
} from "./bloqueoSalidaKiosco";

const CINCO_MIN = 5 * 60 * 1000;

beforeEach(() => {
  sessionStorage.clear();
  limpiarBloqueoSalida();
});
afterEach(() => vi.restoreAllMocks());

describe("bloqueoSalidaKiosco", () => {
  it("recuerda la espera del 429 y un bloqueo vencido vuelve a cero", () => {
    const t0 = 1_000_000;
    expect(leerBloqueoSalida(t0)).toBe(0);
    expect(registrarBloqueoSalida(CINCO_MIN, t0)).toBe(t0 + CINCO_MIN);
    expect(leerBloqueoSalida(t0 + CINCO_MIN - 1)).toBe(t0 + CINCO_MIN);
    expect(leerBloqueoSalida(t0 + CINCO_MIN)).toBe(0);
  });

  it("limpiar lo borra y un valor corrupto se ignora", () => {
    registrarBloqueoSalida(CINCO_MIN);
    limpiarBloqueoSalida();
    expect(leerBloqueoSalida()).toBe(0);
    sessionStorage.setItem("kiosco-salida-bloqueo", "{no json");
    expect(leerBloqueoSalida()).toBe(0);
  });

  it("sigue en memoria si sessionStorage no está disponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("bloqueado"); });
    const t0 = 2_000_000;
    registrarBloqueoSalida(60_000, t0);
    expect(leerBloqueoSalida(t0 + 1)).toBe(t0 + 60_000);
  });

  it("si se puede leer pero dejan de funcionar las escrituras, manda la memoria", () => {
    const t0 = 3_000_000;
    registrarBloqueoSalida(1_000, t0); // este sí queda en sessionStorage
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("cuota"); });
    registrarBloqueoSalida(CINCO_MIN, t0);
    expect(leerBloqueoSalida(t0 + 2_000)).toBe(t0 + CINCO_MIN);
  });

  it("formatea la cuenta atrás en m:ss", () => {
    expect(formatoCuentaAtras(CINCO_MIN)).toBe("5:00");
    expect(formatoCuentaAtras(64_001)).toBe("1:05");
    expect(formatoCuentaAtras(-5)).toBe("0:00");
  });
});
