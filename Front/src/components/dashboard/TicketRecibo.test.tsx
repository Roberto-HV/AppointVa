import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketRecibo from "./TicketRecibo";
import type { CitaDto } from "../../types";

const cita: CitaDto = {
  id: "cita-1",
  codigoConfirmacion: "ABC123",
  clienteId: "c1",
  empleadoId: "e1",
  servicioId: "s1",
  nombreCliente: "Ana García",
  telefonoCliente: "555-1234",
  nombreEmpleado: "Sofía Hernández",
  nombreServicio: "Corte de dama",
  duracionMinutos: 30,
  precio: 280,
  montoCobrado: 280,
  montoRecibido: 300,
  cambio: 20,
  metodoPago: "Efectivo",
  fechaPago: "2026-07-31T15:00:00Z",
  inicioEn: "2026-07-31T11:30:00Z",
  finEn: "2026-07-31T12:00:00Z",
  pagada: true,
  estado: 2,
  estadoTexto: "Confirmada",
};

describe("TicketRecibo", () => {
  it("muestra el nombre del cliente", () => {
    render(
      <TicketRecibo
        cita={cita}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={vi.fn()}
        enviandoEmail={false}
      />
    );
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("muestra el monto cobrado y el cambio", () => {
    render(
      <TicketRecibo
        cita={cita}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={vi.fn()}
        enviandoEmail={false}
      />
    );
    expect(screen.getByText(/\$280/)).toBeInTheDocument();
    expect(screen.getByText(/\$20/)).toBeInTheDocument();
  });

  it("llama onEnviarEmail al presionar el botón de email", async () => {
    const onEnviarEmail = vi.fn();
    render(
      <TicketRecibo
        cita={cita}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={onEnviarEmail}
        enviandoEmail={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /email/i }));
    expect(onEnviarEmail).toHaveBeenCalledOnce();
  });

  it("no muestra fila de cambio si metodoPago no es Efectivo", () => {
    render(
      <TicketRecibo
        cita={{ ...cita, metodoPago: "Tarjeta", cambio: null }}
        negocioNombre="Salón Ejemplo"
        onClose={vi.fn()}
        onEnviarEmail={vi.fn()}
        enviandoEmail={false}
      />
    );
    expect(screen.queryByText(/cambio/i)).not.toBeInTheDocument();
  });
});
