import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResumenReserva from "./ResumenReserva";
import type { ServicioPublico } from "../../types";

const servicio: ServicioPublico = {
  id: "srv-1",
  nombre: "Corte de cabello",
  duracionMinutos: 45,
  bufferMinutos: 0,
  precio: 300,
  orden: 1,
};

describe("ResumenReserva", () => {
  it("sin servicio pide elegir uno y no muestra total", () => {
    render(<ResumenReserva negocioNombre="Salón Test" servicio={null} total={null} />);
    expect(screen.getByText("Elige un servicio para continuar.")).toBeInTheDocument();
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });

  it("con descuento tacha el precio de lista y muestra el final", () => {
    render(<ResumenReserva negocioNombre="Salón Test" servicio={servicio} total={240} />);
    expect(screen.getByText("$240")).toBeInTheDocument();
    const tachado = screen.getAllByText("$300").find((el) => el.classList.contains("line-through"));
    expect(tachado).toBeDefined();
  });

  it("muestra quién atiende con la etiqueta del sector y el horario", () => {
    render(
      <ResumenReserva
        negocioNombre="Clínica"
        servicio={servicio}
        total={300}
        profesional={{ etiqueta: "Especialista", nombre: "Dra. Ruiz" }}
        fechaHora="30 oct 2026 · 10:00"
        acciones={<button>Continuar</button>}
      />,
    );
    expect(screen.getByText("Especialista")).toBeInTheDocument();
    expect(screen.getByText("Dra. Ruiz")).toBeInTheDocument();
    expect(screen.getByText("30 oct 2026 · 10:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });
});
