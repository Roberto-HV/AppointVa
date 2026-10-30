import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import Modal from "./Modal";
import ModalAcciones from "./ModalAcciones";

// I13: el mismo `Modal` es hoja inferior por debajo de `sm` (640px) y diálogo
// centrado arriba. Se simula el ancho con `matchMedia`, como en AccionesCita.
const matchMediaOriginal = window.matchMedia;
function simular(movil: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: movil && q.includes("max-width"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => { window.matchMedia = matchMediaOriginal; });

function Formulario({ onCerrar = vi.fn() }: { onCerrar?: () => void }) {
  return (
    <Modal abierto onCerrar={onCerrar} titulo="Nueva categoría">
      <form>
        <label htmlFor="nombre">Nombre</label>
        <input id="nombre" />
        <ModalAcciones>
          <button type="button" onClick={onCerrar}>Cancelar</button>
          <button type="submit">Crear categoría</button>
        </ModalAcciones>
      </form>
    </Modal>
  );
}

describe("Modal — hoja inferior en el teléfono y diálogo en escritorio (I13)", () => {
  it("en escritorio es el diálogo centrado y el pie no se fija", () => {
    simular(false);
    render(<Formulario />);
    const dialogo = screen.getByRole("dialog", { name: "Nueva categoría" });
    expect(dialogo).toHaveAttribute("data-variante", "dialogo");
    expect(dialogo.className).toContain("top-[50%]");
    expect(screen.queryByTestId("asa-hoja")).toBeNull();
    const pie = screen.getByRole("button", { name: "Crear categoría" }).parentElement!;
    expect(pie).not.toHaveAttribute("data-pie-modal");
    expect(pie.className).not.toContain("sticky");
  });

  it("en el teléfono es una hoja pegada abajo, con asa y el pie de acciones fijo", () => {
    simular(true);
    render(<Formulario />);
    const hoja = screen.getByRole("dialog", { name: "Nueva categoría" });
    expect(hoja).toHaveAttribute("data-variante", "hoja");
    expect(hoja.className).toContain("bottom-0");
    expect(hoja.className).toContain("rounded-t-2xl");
    expect(hoja.className).toContain("slide-in-from-bottom");
    expect(within(hoja).getByTestId("asa-hoja")).toBeInTheDocument();
    // El cuerpo hace scroll por dentro y el pie queda pegado abajo, con la zona segura.
    const pie = within(hoja).getByRole("button", { name: "Crear categoría" }).parentElement!;
    expect(pie).toHaveAttribute("data-pie-modal", "fijo");
    expect(pie.className).toContain("sticky");
    expect(pie.className).toContain("bottom-0");
    expect(pie.className).toContain("safe-area-inset-bottom");
    expect(pie.parentElement!.closest(".overflow-y-auto")).not.toBeNull();
  });

  it("la hoja conserva el foco atrapado, Escape y el botón Cerrar", async () => {
    simular(true);
    const onCerrar = vi.fn();
    render(<Formulario onCerrar={onCerrar} />);
    const hoja = screen.getByRole("dialog", { name: "Nueva categoría" });
    // Radix enfoca lo primero enfocable de la hoja al abrir.
    expect(hoja.contains(document.activeElement)).toBe(true);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(hoja.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(onCerrar).toHaveBeenCalledTimes(1);
    await userEvent.click(within(hoja).getByRole("button", { name: "Cerrar" }));
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it("arrastrar el asa hacia abajo cierra la hoja; un arrastre corto la regresa", () => {
    simular(true);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    const onCerrar = vi.fn();
    render(<Formulario onCerrar={onCerrar} />);
    const asa = screen.getByTestId("asa-hoja");
    const hoja = screen.getByRole("dialog");

    fireEvent.pointerDown(asa, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(asa, { clientY: 140, pointerId: 1 });
    expect(hoja.style.transform).toBe("translateY(40px)");
    fireEvent.pointerUp(asa, { pointerId: 1 });
    expect(onCerrar).not.toHaveBeenCalled();
    expect(hoja.style.transform).toBe("");

    fireEvent.pointerDown(asa, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(asa, { clientY: 260, pointerId: 1 });
    fireEvent.pointerUp(asa, { pointerId: 1 });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("los campos de la hoja se escriben con normalidad", async () => {
    simular(true);
    function Controlado() {
      const [v, setV] = useState("");
      return (
        <Modal abierto onCerrar={() => {}} titulo="Editar cliente">
          <label htmlFor="n">Nombre</label>
          <input id="n" value={v} onChange={(e) => setV(e.target.value)} />
        </Modal>
      );
    }
    render(<Controlado />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
  });
});
