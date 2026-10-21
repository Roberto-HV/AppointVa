import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AVISO_INACTIVIDAD_MS, TIMEOUT_INACTIVIDAD_MS, useInactividadTimeout } from "./useInactividadTimeout";

describe("useInactividadTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("avisa un minuto antes y cierra la sesión al cumplirse la hora", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useInactividadTimeout(onTimeout));
    act(() => { vi.advanceTimersByTime(TIMEOUT_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS); });
    expect(result.current.aviso).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(AVISO_INACTIVIDAD_MS); });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("'Seguir conectado' quita el aviso y reinicia la cuenta", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useInactividadTimeout(onTimeout));
    act(() => { vi.advanceTimersByTime(TIMEOUT_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS); });
    act(() => result.current.seguir());
    expect(result.current.aviso).toBe(false);
    act(() => { vi.advanceTimersByTime(AVISO_INACTIVIDAD_MS + 1000); });
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("el scroll de un contenedor interno cuenta como actividad", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useInactividadTimeout(onTimeout));
    const main = document.createElement("main");
    document.body.appendChild(main);
    act(() => { vi.advanceTimersByTime(TIMEOUT_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS - 1000); });
    // `scroll` en un elemento no burbujea: solo llega a window en fase de captura.
    act(() => { main.dispatchEvent(new Event("scroll", { bubbles: false })); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.aviso).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
    main.remove();
  });
});
