import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ToastContainer from "./ToastContainer";
import { useToastStore } from "../../store/toastStore";

describe("ToastContainer", () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }));
  afterEach(() => act(() => useToastStore.setState({ toasts: [] })));

  it("anuncia éxitos en una región status y errores en una región alert", () => {
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().toast("Cita confirmada");
      useToastStore.getState().toast("No se pudo guardar", "error");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Cita confirmada");
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("muestra la acción y la ejecuta al pulsarla", async () => {
    const onClick = vi.fn();
    render(<ToastContainer />);
    act(() => {
      useToastStore.getState().toast("Pago revertido", "exito", { accion: { etiqueta: "Deshacer", onClick } });
    });
    await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("no reanuda el cierre al salir el puntero mientras el foco sigue dentro", () => {
    vi.useFakeTimers();
    try {
      render(<ToastContainer />);
      act(() => { useToastStore.getState().toast("Guardado"); });
      const cerrar = screen.getByRole("button", { name: "Cerrar aviso" });
      const toast = cerrar.parentElement!;
      act(() => {
        fireEvent.focus(cerrar);
        fireEvent.pointerEnter(toast);
        fireEvent.pointerLeave(toast);
      });
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(useToastStore.getState().toasts).toHaveLength(1);

      // Al salir también el foco, el temporizador sí se reanuda.
      act(() => { fireEvent.blur(cerrar, { relatedTarget: document.body }); });
      act(() => { vi.advanceTimersByTime(4_000); });
      expect(useToastStore.getState().toasts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("el botón de cerrar tiene nombre accesible", async () => {
    render(<ToastContainer />);
    act(() => { useToastStore.getState().toast("Guardado"); });
    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
