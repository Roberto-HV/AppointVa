import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const reducir = vi.hoisted(() => ({ valor: false }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => reducir.valor }));

import { useEntradaAnimada } from "./useEntradaAnimada";

beforeEach(() => { reducir.valor = false; });

describe("useEntradaAnimada (OM-33)", () => {
  it("anima la primera entrada y no las siguientes", () => {
    const { result } = renderHook(() => useEntradaAnimada());
    expect(result.current.initial).toBe("hidden");
    act(() => result.current.onAnimationComplete());
    expect(result.current.initial).toBe(false);
  });

  it("con movimiento reducido no anima nunca", () => {
    reducir.valor = true;
    const { result } = renderHook(() => useEntradaAnimada());
    expect(result.current.initial).toBe(false);
  });
});
