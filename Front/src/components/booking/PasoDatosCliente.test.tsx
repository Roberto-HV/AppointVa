import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasoDatosCliente from "./PasoDatosCliente";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible } from "../../types";

vi.mock("./PasoEmpleado", () => ({
  SIN_PREFERENCIA_ID: "sin-preferencia",
}));

vi.mock("../../utils/formatters", () => ({
  formatPrecio: (v: number) => `$${v}`,
  formatFechaLarga: () => "martes, 22 de julio de 2026",
}));

const mockServicio: ServicioPublico = {
  id: "srv-1",
  nombre: "Corte de cabello",
  duracionMinutos: 30,
  bufferMinutos: 0,
  precio: 150,
  orden: 1,
};

const mockEmpleado: EmpleadoPublico = {
  id: "emp-1",
  nombre: "Ana García",
  servicioIds: ["srv-1"],
  promedioResenas: 0,
  totalResenas: 0,
};

const mockSlot: SlotDisponible = {
  inicio: "2026-07-22T10:00:00",
  fin: "2026-07-22T10:30:00",
  horaTexto: "10:00",
};

function renderComponente(datosIniciales?: { emailCliente?: string }) {
  return render(
    <PasoDatosCliente
      servicio={mockServicio}
      empleado={mockEmpleado}
      slot={mockSlot}
      enviando={false}
      datosIniciales={datosIniciales}
      onEnviar={vi.fn()}
    />
  );
}

describe("PasoDatosCliente — aviso de email", () => {
  it("no muestra el aviso cuando el campo de email tiene valor", async () => {
    renderComponente({ emailCliente: "usuario@test.com" });
    const input = screen.getByPlaceholderText(/correo@ejemplo\.com/i);
    fireEvent.blur(input);
    expect(
      screen.queryByText(/sin correo no recibirás confirmación/i)
    ).not.toBeInTheDocument();
  });

  it("muestra el aviso cuando el campo está vacío y fue tocado", () => {
    renderComponente();
    const input = screen.getByPlaceholderText(/correo@ejemplo\.com/i);
    fireEvent.blur(input);
    expect(
      screen.getByText(/sin correo no recibirás confirmación/i)
    ).toBeInTheDocument();
  });

  it("no muestra el aviso antes de que el campo sea tocado", () => {
    renderComponente();
    expect(
      screen.queryByText(/sin correo no recibirás confirmación/i)
    ).not.toBeInTheDocument();
  });
});
