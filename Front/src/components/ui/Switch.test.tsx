import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Switch from "./Switch";

function SwitchControlado({ inicial = false, onCambiar = () => {} }: { inicial?: boolean; onCambiar?: (v: boolean) => void }) {
  const [activo, setActivo] = useState(inicial);
  return (
    <>
      <span id="etq">Confirmación automática</span>
      <Switch activo={activo} idEtiqueta="etq" onCambiar={(v) => { setActivo(v); onCambiar(v); }} />
    </>
  );
}

describe("Switch", () => {
  it("se anuncia como interruptor con su nombre y su estado", () => {
    render(<SwitchControlado inicial />);
    const sw = screen.getByRole("switch", { name: "Confirmación automática" });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("acepta un nombre directo cuando no hay texto visible", () => {
    render(<Switch activo={false} etiqueta="Lunes abierto" onCambiar={() => {}} />);
    expect(screen.getByRole("switch", { name: "Lunes abierto" })).toHaveAttribute("aria-checked", "false");
  });

  it("se puede enfocar con Tab y cambiar con Espacio y Enter", async () => {
    const user = userEvent.setup();
    const onCambiar = vi.fn();
    render(<SwitchControlado onCambiar={onCambiar} />);
    await user.tab();
    const sw = screen.getByRole("switch");
    expect(sw).toHaveFocus();

    await user.keyboard(" ");
    expect(sw).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Enter}");
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(onCambiar).toHaveBeenNthCalledWith(1, true);
    expect(onCambiar).toHaveBeenNthCalledWith(2, false);
  });

  it("las flechas encienden y apagan", async () => {
    const user = userEvent.setup();
    render(<SwitchControlado />);
    const sw = screen.getByRole("switch");
    sw.focus();
    await user.keyboard("{ArrowRight}");
    expect(sw).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{ArrowLeft}");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("deshabilitado no cambia", async () => {
    const user = userEvent.setup();
    const onCambiar = vi.fn();
    render(<Switch activo={false} etiqueta="X" disabled onCambiar={onCambiar} />);
    await user.click(screen.getByRole("switch"));
    expect(onCambiar).not.toHaveBeenCalled();
  });
});
