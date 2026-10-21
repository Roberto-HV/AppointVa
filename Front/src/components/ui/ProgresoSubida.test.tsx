import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProgresoSubida from "./ProgresoSubida";

describe("ProgresoSubida", () => {
  it("con porcentaje muestra el avance", () => {
    render(<ProgresoSubida porcentaje={40} etiqueta="Subiendo logo" />);
    const barra = screen.getByRole("progressbar", { name: "Subiendo logo" });
    expect(barra).toHaveAttribute("aria-valuenow", "40");
    expect(barra).toHaveAttribute("data-estado", "subiendo");
    expect(screen.queryByText("Procesando…")).not.toBeInTheDocument();
  });

  it("sin total conocido es indeterminada, no un 0 %", () => {
    render(<ProgresoSubida porcentaje={null} etiqueta="Subiendo logo" />);
    const barra = screen.getByRole("progressbar", { name: "Subiendo logo" });
    expect(barra).not.toHaveAttribute("aria-valuenow");
    expect(barra).toHaveAttribute("data-estado", "indeterminado");
  });

  it("al 100 % dice que el servidor está procesando", () => {
    render(<ProgresoSubida porcentaje={100} etiqueta="Subiendo logo" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-estado", "procesando");
    expect(screen.getByRole("status")).toHaveTextContent("Procesando…");
  });
});
