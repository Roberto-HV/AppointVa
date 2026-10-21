import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../api/auth", () => ({ verificarSlug: vi.fn() }));
import { verificarSlug } from "../api/auth";
import { useDisponibilidadSlug, slugConsultable } from "./useDisponibilidadSlug";

// Con llaves: si beforeEach devuelve una función, Vitest la ejecuta como limpieza.
beforeEach(() => {
  vi.mocked(verificarSlug).mockReset();
});

describe("useDisponibilidadSlug (AP-23)", () => {
  it("no consulta slugs cortos o con caracteres no válidos", () => {
    expect(slugConsultable("a")).toBe(false);
    expect(slugConsultable("Mi Salon")).toBe(false);
    const { result } = renderHook(() => useDisponibilidadSlug("a", 0));
    expect(result.current).toBe("idle");
    expect(verificarSlug).not.toHaveBeenCalled();
  });

  it("pasa de 'checking' al resultado del slug vigente", async () => {
    vi.mocked(verificarSlug).mockResolvedValue({ disponible: false });
    const { result, rerender } = renderHook(({ s }) => useDisponibilidadSlug(s, 0), { initialProps: { s: "salon-uno" } });
    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("taken"));

    // Un slug nuevo vuelve a "checking": la respuesta anterior no vale para él.
    vi.mocked(verificarSlug).mockResolvedValue({ disponible: true });
    rerender({ s: "salon-dos" });
    expect(result.current).toBe("checking");
    await waitFor(() => expect(result.current).toBe("available"));
  });

  it("si la consulta falla vuelve a 'idle'", async () => {
    vi.mocked(verificarSlug).mockImplementation(async () => {
      throw new Error("red");
    });
    const { result } = renderHook(() => useDisponibilidadSlug("salon", 0));
    await waitFor(() => expect(result.current).toBe("idle"));
  });
});
