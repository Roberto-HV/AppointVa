import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/empleados", () => ({ empleadosApi: { contarCitasFuturas: vi.fn() } }));
vi.mock("../api/servicios", () => ({ serviciosApi: { contarCitasFuturas: vi.fn() } }));

import { empleadosApi } from "../api/empleados";
import { serviciosApi } from "../api/servicios";
import { contarCitasFuturas, enlaceCitasFuturas } from "./citasFuturas";

beforeEach(() => vi.clearAllMocks());

describe("contarCitasFuturas (B13)", () => {
  it("cuenta las de un empleado con el endpoint del servidor", async () => {
    vi.mocked(empleadosApi.contarCitasFuturas).mockResolvedValue(4);
    await expect(contarCitasFuturas({ empleadoId: "emp-1" })).resolves.toEqual({ total: 4, completo: true });
    expect(empleadosApi.contarCitasFuturas).toHaveBeenCalledWith("emp-1");
    expect(serviciosApi.contarCitasFuturas).not.toHaveBeenCalled();
  });

  it("cuenta las de un servicio con el endpoint del servidor, siempre completo", async () => {
    vi.mocked(serviciosApi.contarCitasFuturas).mockResolvedValue(700);
    await expect(contarCitasFuturas({ servicioId: "svc-1" })).resolves.toEqual({ total: 700, completo: true });
    expect(serviciosApi.contarCitasFuturas).toHaveBeenCalledWith("svc-1");
  });

  it("propaga el error para que el diálogo falle cerrado", async () => {
    vi.mocked(empleadosApi.contarCitasFuturas).mockRejectedValue(new Error("red"));
    await expect(contarCitasFuturas({ empleadoId: "emp-1" })).rejects.toThrow("red");
  });
});

describe("enlaceCitasFuturas", () => {
  it("enlaza a Citas desde hoy, filtrando por empleado si se indica", () => {
    expect(enlaceCitasFuturas("emp-1")).toMatch(/^\/dashboard\/citas\?desde=\d{4}-\d{2}-\d{2}&hasta=&empleadoId=emp-1$/);
    expect(enlaceCitasFuturas()).not.toContain("empleadoId");
  });
});
