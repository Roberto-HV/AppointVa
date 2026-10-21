import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DURACION_TOAST, useToastStore } from "./toastStore";

const estado = () => useToastStore.getState();

describe("toastStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un toast de éxito desaparece a los 3.5s", () => {
    estado().toast("Guardado");
    expect(estado().toasts).toHaveLength(1);
    vi.advanceTimersByTime(DURACION_TOAST.normal - 1);
    expect(estado().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(estado().toasts).toHaveLength(0);
  });

  it("un error dura 8s, no 3.5s", () => {
    estado().toast("Falló", "error");
    vi.advanceTimersByTime(DURACION_TOAST.normal + 100);
    expect(estado().toasts).toHaveLength(1);
    vi.advanceTimersByTime(DURACION_TOAST.error);
    expect(estado().toasts).toHaveLength(0);
  });

  it("guarda la acción y le da más tiempo al toast", () => {
    const onClick = vi.fn();
    estado().toast("Pago revertido", "exito", { accion: { etiqueta: "Deshacer", onClick } });
    expect(estado().toasts[0].accion?.etiqueta).toBe("Deshacer");
    vi.advanceTimersByTime(DURACION_TOAST.normal + 100);
    expect(estado().toasts).toHaveLength(1);
    vi.advanceTimersByTime(DURACION_TOAST.conAccion);
    expect(estado().toasts).toHaveLength(0);
  });

  it("ejecutarAccion llama a la acción una sola vez y quita el toast", () => {
    const onClick = vi.fn();
    const id = estado().toast("Nota eliminada", "exito", { accion: { etiqueta: "Deshacer", onClick } });
    estado().ejecutarAccion(id);
    estado().ejecutarAccion(id);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(estado().toasts).toHaveLength(0);
  });

  it("pausar detiene el cierre y reanudar continúa con el tiempo restante", () => {
    const id = estado().toast("Guardado");
    vi.advanceTimersByTime(1000);
    estado().pausar(id);
    vi.advanceTimersByTime(60_000);
    expect(estado().toasts).toHaveLength(1);
    estado().reanudar(id);
    vi.advanceTimersByTime(DURACION_TOAST.normal - 1000 - 1);
    expect(estado().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(estado().toasts).toHaveLength(0);
  });

  it("quitar cancela el temporizador", () => {
    const id = estado().toast("Guardado");
    estado().quitar(id);
    expect(estado().toasts).toHaveLength(0);
    vi.advanceTimersByTime(DURACION_TOAST.normal);
    expect(estado().toasts).toHaveLength(0);
  });
});
