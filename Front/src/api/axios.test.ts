import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { api, MOTIVO_RECEPCION_VENCIDA } from "./axios";
import { useAuthStore } from "../store/authStore";

// The 401 path of the response interceptor when there is no refresh token to try.

const ubicacion = { href: "" };
const original = window.location;

function responder401() {
  api.defaults.adapter = (config: InternalAxiosRequestConfig) =>
    Promise.reject(new AxiosError("401", "ERR_BAD_REQUEST", config, undefined, {
      status: 401, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: {},
    }));
}

beforeEach(() => {
  localStorage.clear();
  ubicacion.href = "";
  Object.defineProperty(window, "location", { configurable: true, value: ubicacion });
  responder401();
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: original });
});

const usuario = (rol: string) => ({ id: "u-1", email: "a@b.mx", nombreCompleto: "A", rol, negocioId: "n-1" });

describe("api — 401 sin refresh token", () => {
  it("una sesión de recepción vencida manda al login con el motivo", async () => {
    useAuthStore.setState({ token: "t-kiosco", refreshToken: null, usuario: usuario("Kiosco") });

    await expect(api.get("/kiosco/agenda")).rejects.toBeInstanceOf(AxiosError);

    expect(ubicacion.href).toBe(`/login?motivo=${MOTIVO_RECEPCION_VENCIDA}`);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("cualquier otra sesión va al login sin motivo", async () => {
    useAuthStore.setState({ token: "t", refreshToken: null, usuario: usuario("Propietario") });

    await expect(api.get("/citas")).rejects.toBeInstanceOf(AxiosError);

    expect(ubicacion.href).toBe("/login");
  });
});
