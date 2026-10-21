import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFadeInUp, CONSULTA_MOVIMIENTO_REDUCIDO } from "./useFadeInUp";

function simularMatchMedia(reducido: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: reducido && q === CONSULTA_MOVIMIENTO_REDUCIDO,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFadeInUp (AP-20)", () => {
  it("con movimiento reducido el contenido es visible desde el inicio y sin transición", () => {
    simularMatchMedia(true);
    const { result } = renderHook(() => useFadeInUp(120));
    expect(result.current.style.opacity).toBe(1);
    expect(result.current.style.transform).toBe("translateY(0)");
    expect(result.current.style.transition).toBeUndefined();
  });

  it("sin preferencia empieza oculto y anima la entrada", () => {
    simularMatchMedia(false);
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
    const { result } = renderHook(() => useFadeInUp(120));
    expect(result.current.style.opacity).toBe(0);
    expect(result.current.style.transition).toContain("120ms");
  });
});
