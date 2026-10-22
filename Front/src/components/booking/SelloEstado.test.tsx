import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SelloEstado from "./SelloEstado";

const reducir = vi.hoisted(() => ({ valor: false }));

vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return { ...mod, useReducedMotion: () => reducir.valor };
});

beforeEach(() => {
  reducir.valor = false;
});

describe("SelloEstado", () => {
  it("confirmada usa los tokens de estado confirmado", () => {
    render(<SelloEstado etiqueta="Confirmada" tono="confirmado" />);
    const sello = screen.getByText("Confirmada");
    expect(sello).toHaveClass("bg-status-confirmed-bg", "text-status-confirmed-fg");
  });

  it("por confirmar usa los tokens de estado pendiente", () => {
    render(<SelloEstado etiqueta="Por confirmar" tono="pendiente" />);
    expect(screen.getByText("Por confirmar")).toHaveClass("bg-status-pending-bg", "text-status-pending-fg");
  });

  it("neutro usa los tokens apagados y muestra la etiqueta tal cual", () => {
    render(<SelloEstado etiqueta="Inasistencia" tono="neutro" />);
    expect(screen.getByText("Inasistencia")).toHaveClass("bg-status-absent-bg", "text-status-absent-fg");
  });

  it("cae con animación cuando se permite el movimiento", () => {
    render(<SelloEstado etiqueta="Confirmada" tono="confirmado" />);
    expect(screen.getByText("Confirmada")).toHaveAttribute("data-animado", "si");
  });

  it("con 'reducir movimiento' aparece ya puesto, sin animar", () => {
    reducir.valor = true;
    render(<SelloEstado etiqueta="Confirmada" tono="confirmado" />);
    const sello = screen.getByText("Confirmada");
    expect(sello).toHaveAttribute("data-animado", "no");
    // Sin estado inicial: no arranca transparente ni escalado.
    expect(sello.style.opacity).not.toBe("0");
  });
});
