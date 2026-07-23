import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasoServicio from "./PasoServicio";
import type { ServicioPublico } from "../../types";

vi.mock("../../utils/formatters", () => ({
  formatPrecio: (v: number) => `$${v}`,
}));

const mockServicios: ServicioPublico[] = [
  {
    id: "srv-1",
    nombre: "Corte de cabello",
    duracionMinutos: 30,
    bufferMinutos: 0,
    precio: 150,
    orden: 1,
  },
  {
    id: "srv-2",
    nombre: "Coloración",
    duracionMinutos: 60,
    bufferMinutos: 0,
    precio: 300,
    orden: 2,
  },
];

describe("PasoServicio", () => {
  it("renders service list when services are provided", () => {
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
    expect(screen.getByText("Coloración")).toBeInTheDocument();
  });

  it("shows name and price for each service card", () => {
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={vi.fn()}
      />
    );
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
    expect(screen.getByText("$150")).toBeInTheDocument();
    expect(screen.getByText("Coloración")).toBeInTheDocument();
    expect(screen.getByText("$300")).toBeInTheDocument();
  });

  it("calls onSeleccionar with the correct service when clicked", () => {
    const onSeleccionar = vi.fn();
    render(
      <PasoServicio
        servicios={mockServicios}
        seleccionado={null}
        onSeleccionar={onSeleccionar}
      />
    );
    fireEvent.click(screen.getByText("Corte de cabello"));
    expect(onSeleccionar).toHaveBeenCalledWith(mockServicios[0]);
  });

  it("renders without crashing when services list is empty", () => {
    render(
      <PasoServicio servicios={[]} seleccionado={null} onSeleccionar={vi.fn()} />
    );
    expect(screen.getByText(/¿Qué servicio necesitas?/i)).toBeInTheDocument();
  });
});
