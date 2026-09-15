import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

type Props = React.ComponentProps<typeof PasoDatosCliente>;

function renderComponente(props: Partial<Props> = {}) {
  return render(
    <PasoDatosCliente
      servicio={mockServicio}
      empleado={mockEmpleado}
      slot={mockSlot}
      formId="form-datos-cliente"
      politicasAceptadas={false}
      onPoliticasAceptadasChange={vi.fn()}
      onEnviar={vi.fn()}
      {...props}
    />
  );
}

describe("PasoDatosCliente — aviso de email", () => {
  it("no muestra el aviso cuando el campo de email tiene valor", async () => {
    renderComponente();
    const input = screen.getByPlaceholderText(/correo@ejemplo\.com/i);
    fireEvent.change(input, { target: { value: "usuario@test.com" } });
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

describe("PasoDatosCliente — notasLabel prop", () => {
  it('shows "Notas (opcional)" label by default', () => {
    renderComponente();
    expect(screen.getByText('Notas (opcional)')).toBeInTheDocument();
  });

  it('shows the notasLabel prop when provided', () => {
    renderComponente({ notasLabel: "Motivo de consulta" });
    expect(screen.getByText('Motivo de consulta')).toBeInTheDocument();
    expect(screen.queryByText('Notas (opcional)')).not.toBeInTheDocument();
  });
});

describe("PasoDatosCliente — submit externo", () => {
  it("expone el formulario con el id recibido y sin botón de envío propio", () => {
    const { container } = renderComponente({ formId: "mi-form" });
    expect(container.querySelector("#mi-form")).toBeTruthy();
    expect(container.querySelector('button[type="submit"]')).toBeNull();
  });

  it("delega el estado de las políticas al padre", () => {
    const onPoliticasAceptadasChange = vi.fn();
    renderComponente({ politicasUrl: "https://ejemplo.test/politicas.png", onPoliticasAceptadasChange });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onPoliticasAceptadasChange).toHaveBeenCalledWith(true);
  });

  // handleSubmit de react-hook-form pasa el evento como 2º argumento. Si se filtra,
  // el padre lo recibe como flag y el DTO se vuelve circular: JSON.stringify revienta
  // y la petición nunca sale.
  it("invoca onEnviar solo con los datos, sin el evento del submit", async () => {
    const onEnviar = vi.fn();
    const { container } = renderComponente({ onEnviar });

    fireEvent.change(screen.getByPlaceholderText("Tu nombre completo"), { target: { value: "Ana Martínez" } });
    fireEvent.change(screen.getByPlaceholderText("55 1234 5678"), { target: { value: "5512345678" } });
    fireEvent.submit(container.querySelector("#form-datos-cliente")!);

    await waitFor(() => expect(onEnviar).toHaveBeenCalled());
    expect(onEnviar.mock.calls[0]).toHaveLength(1);
  });
});
