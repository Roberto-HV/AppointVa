import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const reducir = vi.hoisted(() => ({ valor: false }));
const animate = vi.hoisted(() => vi.fn(() => ({ stop: vi.fn() })));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducir.valor,
  animate,
}));

import AnimatedCounter from "./AnimatedCounter";

beforeEach(() => {
  animate.mockClear();
  reducir.valor = false;
});

describe("AnimatedCounter (DC-26)", () => {
  it("el lector de pantalla lee el valor final, no el 0 inicial", () => {
    render(<AnimatedCounter to={42} />);
    expect(screen.getByText("42")).toHaveClass("sr-only");
  });

  it("al cambiar el valor anima desde el anterior, no desde 0", () => {
    const { rerender } = render(<AnimatedCounter to={10} />);
    expect(animate).toHaveBeenLastCalledWith(0, 10, expect.anything());
    // Simula que la animación llegó a su final.
    const opciones = (animate.mock.calls[0] as unknown[])[2] as { onUpdate: (v: number) => void };
    opciones.onUpdate(10);
    rerender(<AnimatedCounter to={12} />);
    expect(animate).toHaveBeenLastCalledWith(10, 12, expect.anything());
  });

  it("con 'reducir movimiento' muestra el valor sin animar", () => {
    reducir.valor = true;
    render(<AnimatedCounter to={7} />);
    expect(animate).not.toHaveBeenCalled();
    expect(screen.getAllByText("7")).toHaveLength(2);
  });
});
