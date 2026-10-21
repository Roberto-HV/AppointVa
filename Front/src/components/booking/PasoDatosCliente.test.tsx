import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PasoDatosCliente from "./PasoDatosCliente";
import { publicoApi } from "../../api/publico";
import type { ServicioPublico, EmpleadoPublico, SlotDisponible } from "../../types";

vi.mock("./PasoEmpleado", () => ({
  SIN_PREFERENCIA_ID: "sin-preferencia",
}));

vi.mock("../../api/publico", () => ({
  publicoApi: { buscarClienteDatos: vi.fn() },
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
      slug="salon-test"
      politicasAceptadas={false}
      onPoliticasAceptadasChange={vi.fn()}
      onEnviar={vi.fn()}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(publicoApi.buscarClienteDatos).mockRejectedValue({ response: { status: 404 } });
});

const inputTelefono = () => screen.getByPlaceholderText("55 1234 5678");
const inputNombre = () => screen.getByPlaceholderText("Tu nombre completo") as HTMLInputElement;
const inputEmail = () => screen.getByPlaceholderText(/correo@ejemplo\.com/i) as HTMLInputElement;

/** Escribe un teléfono completo y dispara el blur que lanza la búsqueda. */
function escribirTelefono(valor = "55 1234 5678") {
  const input = inputTelefono();
  fireEvent.change(input, { target: { value: valor } });
  fireEvent.blur(input);
  return input;
}

function clienteEncontrado(nombre = "María López", email: string | null = "maria@ejemplo.com") {
  vi.mocked(publicoApi.buscarClienteDatos).mockResolvedValue({
    nombreCliente: nombre,
    emailCliente: email,
    telefonoCliente: "5512345678",
  });
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

describe("PasoDatosCliente — cliente que ya reservó", () => {
  it("pide el teléfono antes que el nombre", () => {
    const { container } = renderComponente();
    const campos = Array.from(container.querySelectorAll("input, textarea")).map((el) => el.getAttribute("name"));
    expect(campos).toEqual(["telefonoCliente", "nombreCliente", "emailCliente", "notas"]);
  });

  it("consulta una sola vez por número completo, aunque el campo se desenfoque de nuevo", async () => {
    clienteEncontrado();
    renderComponente();
    const input = escribirTelefono();

    await screen.findByText(/encontramos tu cuenta/i);
    fireEvent.blur(input);

    expect(publicoApi.buscarClienteDatos).toHaveBeenCalledTimes(1);
    // El teléfono viaja sólo con dígitos: el backend normaliza igual.
    expect(publicoApi.buscarClienteDatos).toHaveBeenCalledWith("salon-test", "5512345678");
  });

  it("no consulta con un teléfono incompleto", () => {
    renderComponente();
    escribirTelefono("55 1234");
    expect(publicoApi.buscarClienteDatos).not.toHaveBeenCalled();
  });

  it("muestra el nombre completo del cliente encontrado en una región anunciada", async () => {
    clienteEncontrado("María López");
    const { container } = renderComponente();
    escribirTelefono();

    const sugerencia = await screen.findByText(/encontramos tu cuenta/i);
    expect(sugerencia).toHaveTextContent("María López");
    expect(container.querySelector('[role="status"][aria-live="polite"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sí, soy yo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No, no soy yo" })).toBeInTheDocument();
  });

  it("llena nombre y correo al confirmar, y avisa al padre", async () => {
    clienteEncontrado("María López", "maria@ejemplo.com");
    const onClienteReconocidoChange = vi.fn();
    renderComponente({ onClienteReconocidoChange });
    escribirTelefono();

    fireEvent.click(await screen.findByRole("button", { name: "Sí, soy yo" }));

    expect(inputNombre().value).toBe("María López");
    expect(inputEmail().value).toBe("maria@ejemplo.com");
    expect(inputNombre()).not.toBeDisabled();
    expect(inputEmail()).not.toBeDisabled();
    expect(onClienteReconocidoChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(/llenamos tu nombre y tu correo/i)).toBeInTheDocument();
  });

  it("deja los campos en blanco al rechazar la sugerencia", async () => {
    clienteEncontrado("María López");
    const onClienteReconocidoChange = vi.fn();
    renderComponente({ onClienteReconocidoChange });
    escribirTelefono();

    fireEvent.click(await screen.findByRole("button", { name: "No, no soy yo" }));

    expect(inputNombre().value).toBe("");
    expect(inputEmail().value).toBe("");
    expect(screen.queryByText(/encontramos tu cuenta/i)).not.toBeInTheDocument();
    expect(onClienteReconocidoChange).toHaveBeenLastCalledWith(false);
  });

  // Si tras confirmar cambia el nombre, la cita ya no es forzosamente para el cliente
  // registrado: la red de seguridad del 409 tiene que volver a activarse.
  it("revoca la confirmación si el nombre se edita después", async () => {
    clienteEncontrado("María López");
    const onClienteReconocidoChange = vi.fn();
    renderComponente({ onClienteReconocidoChange });
    escribirTelefono();
    fireEvent.click(await screen.findByRole("button", { name: "Sí, soy yo" }));

    fireEvent.change(inputNombre(), { target: { value: "Otra Persona" } });

    await waitFor(() => expect(onClienteReconocidoChange).toHaveBeenLastCalledWith(false));
  });

  it("deja el formulario usable cuando la búsqueda falla", async () => {
    vi.mocked(publicoApi.buscarClienteDatos).mockRejectedValue(new Error("network"));
    const onEnviar = vi.fn();
    const { container } = renderComponente({ onEnviar });
    escribirTelefono();

    await waitFor(() => expect(publicoApi.buscarClienteDatos).toHaveBeenCalled());
    expect(screen.queryByText(/encontramos tu cuenta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/buscando tus datos/i)).not.toBeInTheDocument();

    fireEvent.change(inputNombre(), { target: { value: "Ana Martínez" } });
    fireEvent.submit(container.querySelector("#form-datos-cliente")!);

    await waitFor(() => expect(onEnviar).toHaveBeenCalled());
    expect(onEnviar.mock.calls[0][0]).toMatchObject({ nombreCliente: "Ana Martínez", telefonoCliente: "55 1234 5678" });
  });
});

// ── BF-08: etiquetas ligadas y errores anunciados ─────────────────────────────
describe("PasoDatosCliente — accesibilidad del formulario", () => {
  it("cada campo se encuentra por su etiqueta visible", () => {
    renderComponente();
    expect(screen.getByLabelText(/teléfono/i)).toBe(inputTelefono());
    expect(screen.getByLabelText(/nombre completo/i)).toBe(inputNombre());
    expect(screen.getByLabelText(/correo electrónico/i)).toBe(inputEmail());
    expect(screen.getByLabelText("Notas (opcional)").tagName).toBe("TEXTAREA");
  });

  it("marca los obligatorios con aria-required", () => {
    renderComponente();
    expect(inputTelefono()).toHaveAttribute("aria-required", "true");
    expect(inputNombre()).toHaveAttribute("aria-required", "true");
    expect(inputEmail()).not.toHaveAttribute("aria-required");
  });

  it("marca el campo inválido y lo liga a su mensaje de error", async () => {
    renderComponente();
    expect(inputNombre()).toHaveAttribute("aria-invalid", "false");

    fireEvent.change(inputNombre(), { target: { value: "A" } });
    fireEvent.blur(inputNombre());

    await waitFor(() => expect(inputNombre()).toHaveAttribute("aria-invalid", "true"));
    expect(inputNombre()).toHaveAccessibleDescription("Ingresa tu nombre completo");
  });
});

// ── BF-02: lo escrito sobrevive a ir y volver ─────────────────────────────────
describe("PasoDatosCliente — valores conservados", () => {
  it("arranca con los valores que el padre ya tenía", () => {
    renderComponente({
      valoresIniciales: { telefonoCliente: "5512345678", nombreCliente: "Ana Ruiz", emailCliente: "ana@test.com", notas: "Sin prisa" },
    });
    expect((inputTelefono() as HTMLInputElement).value).toBe("5512345678");
    expect(inputNombre().value).toBe("Ana Ruiz");
    expect(inputEmail().value).toBe("ana@test.com");
    expect((screen.getByLabelText("Notas (opcional)") as HTMLTextAreaElement).value).toBe("Sin prisa");
  });

  it("avisa al padre de cada cambio", async () => {
    const onValoresChange = vi.fn();
    renderComponente({ onValoresChange });
    fireEvent.change(inputNombre(), { target: { value: "Ana" } });
    await waitFor(() =>
      expect(onValoresChange).toHaveBeenLastCalledWith(expect.objectContaining({ nombreCliente: "Ana" }))
    );
  });
});

// ── BF-11: el total del resumen descuenta el código aplicado ──────────────────
describe("PasoDatosCliente — total con descuento", () => {
  const totalAPagar = () => screen.getByText("Total a pagar").nextElementSibling as HTMLElement;

  it("sin código muestra el precio del servicio", () => {
    renderComponente();
    expect(totalAPagar()).toHaveTextContent(/^\$150$/);
  });

  it("con un porcentaje tacha el precio original y muestra el final", () => {
    renderComponente({ descuento: { id: "d1", codigo: "PROMO20", tipo: "Porcentaje", valor: 20 } });
    expect(totalAPagar().querySelector("s")).toHaveTextContent("Precio original $150");
    expect(totalAPagar()).toHaveTextContent(/\$120$/);
  });

  it("un monto fijo mayor al precio deja el total en cero, nunca negativo", () => {
    renderComponente({ descuento: { id: "d1", codigo: "REGALO", tipo: "MontoFijo", valor: 500 } });
    expect(totalAPagar()).toHaveTextContent(/\$0$/);
  });

  it("coloca el bloque del código justo antes del resumen", () => {
    renderComponente({ bloqueDescuento: <div data-testid="bloque-descuento" /> });
    const bloque = screen.getByTestId("bloque-descuento");
    const resumen = screen.getByText("Resumen de tu cita");
    expect(bloque.compareDocumentPosition(resumen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ── BF-14: sin aceptar las políticas, el envío explica por qué no avanza ──────
describe("PasoDatosCliente — políticas sin aceptar", () => {
  function llenarValido() {
    fireEvent.change(inputTelefono(), { target: { value: "5512345678" } });
    fireEvent.change(inputNombre(), { target: { value: "Ana Martínez" } });
  }

  it("no envía y marca la casilla con un mensaje", async () => {
    const onEnviar = vi.fn();
    const { container } = renderComponente({ onEnviar, politicasUrl: "https://ejemplo.test/politicas.png" });
    llenarValido();

    fireEvent.submit(container.querySelector("#form-datos-cliente")!);

    const casilla = screen.getByRole("checkbox");
    await waitFor(() => expect(casilla).toHaveAttribute("aria-invalid", "true"));
    expect(casilla).toHaveAccessibleDescription("Acepta las políticas del negocio para confirmar tu cita");
    expect(document.activeElement).toBe(casilla);
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it("con las políticas aceptadas envía normalmente", async () => {
    const onEnviar = vi.fn();
    const { container } = renderComponente({
      onEnviar,
      politicasUrl: "https://ejemplo.test/politicas.png",
      politicasAceptadas: true,
    });
    llenarValido();

    fireEvent.submit(container.querySelector("#form-datos-cliente")!);

    await waitFor(() => expect(onEnviar).toHaveBeenCalled());
    expect(screen.queryByText(/Acepta las políticas/)).not.toBeInTheDocument();
  });
});

// ── BF-15: mensajes de validación en español y teléfono por dígitos ───────────
describe("PasoDatosCliente — validación", () => {
  beforeEach(() => {
    renderComponente();
  });

  async function mensajeDe(input: HTMLElement, valor: string) {
    fireEvent.change(input, { target: { value: valor } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    return input;
  }

  it("cuenta dígitos, no caracteres: «12 34 56 7» no es un teléfono válido", async () => {
    const input = await mensajeDe(inputTelefono(), "12 34 56 7");
    expect(input).toHaveAccessibleDescription("Ingresa un teléfono válido de 10 dígitos");
  });

  it("explica el límite de largo del teléfono en español", async () => {
    const input = await mensajeDe(inputTelefono(), "55 1234 5678 9012");
    expect(input).toHaveAccessibleDescription("Máximo 15 caracteres");
  });

  it("dice cómo corregir un correo mal escrito", async () => {
    const input = await mensajeDe(inputEmail(), "ana@");
    expect(input).toHaveAccessibleDescription("Revisa el formato del correo (ej. nombre@correo.com)");
  });

  it("explica el límite de las notas en español", async () => {
    const input = await mensajeDe(screen.getByLabelText("Notas (opcional)"), "a".repeat(301));
    expect(input).toHaveAccessibleDescription("Máximo 300 caracteres");
  });
});

// ── BF-12: el error de envío se anuncia ───────────────────────────────────────
describe("PasoDatosCliente — error de envío", () => {
  it("se anuncia como alerta", () => {
    renderComponente({ error: "No se pudo confirmar la cita. Intenta de nuevo." });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo agendar la cita");
  });
});
