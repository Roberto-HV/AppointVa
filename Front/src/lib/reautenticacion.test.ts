import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { kioscoApi } from "../api/kiosco";
import { useAuthStore } from "../store/authStore";
import { entrarAlKiosco, restaurarSesion, salirDelKiosco } from "./reautenticacion";

vi.mock("../api/kiosco", () => ({
  kioscoApi: { iniciar: vi.fn(), agenda: vi.fn(), salir: vi.fn() },
}));

const usuarioDueno = { id: "u-1", email: "d@n.mx", nombreCompleto: "Dueña", rol: "Propietario", negocioId: "n-1" };

function errorHttp(status: number, data: unknown) {
  return new AxiosError(String(status), "ERR", undefined, undefined, {
    status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.getState().iniciarSesion("t-dueno", "r-dueno", usuarioDueno);
});

describe("entrarAlKiosco", () => {
  it("manda el refresh token a revocar y no deja nada que restaure la sesión", async () => {
    vi.mocked(kioscoApi.iniciar).mockResolvedValue({
      token: "t-kiosco", tokenExpiracion: "", usuario: { ...usuarioDueno, rol: "Kiosco" },
    });

    await entrarAlKiosco();

    expect(kioscoApi.iniciar).toHaveBeenCalledWith("r-dueno");
    const estado = useAuthStore.getState();
    expect(estado.token).toBe("t-kiosco");
    expect(estado.refreshToken).toBeNull();
    expect(estado.usuario?.rol).toBe("Kiosco");
    const guardado = localStorage.getItem("appointva-auth") ?? "";
    expect(guardado).not.toContain("r-dueno");
    expect(guardado).not.toContain("t-dueno");
  });

  it("si el servidor falla, la sesión del dueño sigue igual", async () => {
    vi.mocked(kioscoApi.iniciar).mockRejectedValue(new Error("red"));
    await expect(entrarAlKiosco()).rejects.toThrow("red");
    expect(useAuthStore.getState().refreshToken).toBe("r-dueno");
  });
});

describe("salirDelKiosco", () => {
  it("traduce las respuestas del servidor", async () => {
    vi.mocked(kioscoApi.salir).mockResolvedValueOnce({ token: "t", refreshToken: "r", tokenExpiracion: "", usuario: usuarioDueno });
    expect((await salirDelKiosco("x")).tipo).toBe("sesion");

    vi.mocked(kioscoApi.salir).mockResolvedValueOnce({ requiere2FA: true, challengeToken: "c" } as never);
    expect(await salirDelKiosco("x")).toEqual({ tipo: "requiere2FA", challengeToken: "c" });

    vi.mocked(kioscoApi.salir).mockRejectedValueOnce(errorHttp(400, { codigoError: "CONTRASENA_INCORRECTA", intentosRestantes: 1 }));
    expect(await salirDelKiosco("x")).toEqual({ tipo: "incorrecta", intentosRestantes: 1 });

    vi.mocked(kioscoApi.salir).mockRejectedValueOnce(errorHttp(429, { reintentarEnSegundos: 42 }));
    expect(await salirDelKiosco("x")).toEqual({ tipo: "bloqueada", esperaMs: 42_000 });

    // Un 429 sin cuerpo (p. ej. de un proxy) asume la ventana completa.
    vi.mocked(kioscoApi.salir).mockRejectedValueOnce(errorHttp(429, ""));
    expect(await salirDelKiosco("x")).toEqual({ tipo: "bloqueada", esperaMs: 300_000 });
  });

  it("otros errores se lanzan", async () => {
    vi.mocked(kioscoApi.salir).mockRejectedValueOnce(errorHttp(500, {}));
    await expect(salirDelKiosco("x")).rejects.toBeInstanceOf(AxiosError);
    vi.mocked(kioscoApi.salir).mockRejectedValueOnce(errorHttp(400, { mensaje: "otro" }));
    await expect(salirDelKiosco("x")).rejects.toBeInstanceOf(AxiosError);
  });
});

describe("restaurarSesion", () => {
  it("guarda la sesión normal que devolvió la salida", () => {
    useAuthStore.getState().iniciarSesionKiosco("t-kiosco", { ...usuarioDueno, rol: "Kiosco" });
    restaurarSesion({ token: "t2", refreshToken: "r2", tokenExpiracion: "", usuario: usuarioDueno });
    const estado = useAuthStore.getState();
    expect(estado.token).toBe("t2");
    expect(estado.refreshToken).toBe("r2");
    expect(estado.usuario?.rol).toBe("Propietario");
  });
});
