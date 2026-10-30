import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NuevaCitaPanel from "./NuevaCitaPanel";

vi.mock("../../api/citas", () => ({ citasApi: { crear: vi.fn() } }));
vi.mock("../../api/clientes", () => ({ clientesApi: { obtenerTodos: vi.fn() } }));
vi.mock("../../api/empleados", () => ({ empleadosApi: { obtenerTodos: vi.fn() } }));
vi.mock("../../api/servicios", () => ({ serviciosApi: { obtenerTodos: vi.fn() } }));
vi.mock("../../api/axios", () => ({ api: { get: vi.fn() } }));
vi.mock("../../api/negocios", () => ({ negociosApi: { obtenerPerfil: vi.fn().mockResolvedValue({ sector: "belleza" }) } }));
vi.mock("../ui/DateTimePicker", () => ({
  DatePicker: ({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) => (
    <input aria-label={label ?? "Fecha"} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

let rol = "Propietario";
vi.mock("../../store/authStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (sel: (s: any) => unknown) => sel({ usuario: { rol, email: "o@test.com" } }),
}));

import { citasApi } from "../../api/citas";
import { clientesApi } from "../../api/clientes";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { api } from "../../api/axios";

// Hora local: la rejilla y el panel trabajan en la zona del navegador.
const inicio16 = new Date(2030, 0, 10, 16, 0);
const inicio17 = new Date(2030, 0, 10, 17, 0);

function renderizar(precarga?: { inicio?: Date; empleadoId?: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onCerrar = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <NuevaCitaPanel abierto onCerrar={onCerrar} precarga={precarga} />
    </QueryClientProvider>,
  );
  return { panel: screen.getByRole("dialog", { name: "Nueva cita" }), onCerrar };
}

async function llenarClienteYContinuar(panel: HTMLElement) {
  fireEvent.change(within(panel).getByLabelText(/Nombre del cliente/), { target: { value: "Luis Pérez" } });
  fireEvent.change(within(panel).getByLabelText(/Teléfono/), { target: { value: "5512345678" } });
  fireEvent.click(within(panel).getByRole("button", { name: "Continuar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  rol = "Propietario";
  vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([
    { id: "svc-corte", nombre: "Corte", activo: true, duracionMinutos: 45, precio: 280 },
    { id: "svc-tinte", nombre: "Tinte", activo: true, duracionMinutos: 90, precio: 900 },
  ] as never);
  vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([
    { id: "emp-ana", nombre: "Ana", activo: true, servicioIds: ["svc-corte", "svc-tinte"] },
    { id: "emp-beto", nombre: "Beto", activo: true, servicioIds: ["svc-corte"] },
  ] as never);
  vi.mocked(api.get).mockResolvedValue({
    data: [
      { inicio: inicio16.toISOString(), horaTexto: "4:00 p. m." },
      { inicio: inicio17.toISOString(), horaTexto: "5:00 p. m." },
    ],
  });
  vi.mocked(citasApi.crear).mockResolvedValue({} as never);
});

describe("NuevaCitaPanel — pasos (I4)", () => {
  it("muestra los cuatro pasos y en cuál vas", () => {
    const { panel } = renderizar();
    expect(within(panel).getByText("Paso 1 de 4 · Cliente")).toBeInTheDocument();
    const pasos = within(panel).getByRole("list", { name: "Pasos" });
    expect(within(pasos).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Cliente", "Servicio", "Horario", "Confirmar"]);
    expect(within(pasos).getByRole("button", { name: "Cliente" })).toHaveAttribute("aria-current", "step");
  });

  it("busca un cliente existente, lo elige y envía sus datos con el servicio, empleado y hora", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue({
      datos: [{ id: "cli-1", nombreCompleto: "María López", telefono: "5599887766", email: "maria@test.com" }],
      total: 1,
    } as never);
    const { panel, onCerrar } = renderizar();

    fireEvent.change(within(panel).getByLabelText("Buscar cliente"), { target: { value: "mar" } });
    fireEvent.click(await within(panel).findByRole("button", { name: /María López/ }, { timeout: 2000 }));
    expect(clientesApi.obtenerTodos).toHaveBeenCalledWith("mar", 1, 6);
    expect(within(panel).getByText("Cliente existente: María López")).toBeInTheDocument();
    expect(within(panel).getByLabelText(/Teléfono/)).toHaveValue("5599887766");

    fireEvent.click(within(panel).getByRole("button", { name: "Continuar" }));
    // Elegir el servicio avanza solo al paso de horario.
    fireEvent.click(await within(panel).findByRole("button", { name: /Tinte/ }));
    expect(within(panel).getByText("Paso 3 de 4 · Horario")).toBeInTheDocument();
    // Solo Ana ofrece Tinte: queda elegida.
    expect(within(panel).getByRole("button", { name: "Ana" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(within(panel).getByLabelText("Fecha"), { target: { value: "2030-01-10" } });
    fireEvent.click(await within(panel).findByRole("button", { name: "5:00 p. m." }));
    fireEvent.click(within(panel).getByRole("button", { name: "Continuar" }));

    expect(within(panel).getByText("Paso 4 de 4 · Confirmar")).toBeInTheDocument();
    fireEvent.change(within(panel).getByLabelText(/Nota interna/), { target: { value: "Alergia al amoniaco" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Crear cita" }));

    await waitFor(() => expect(citasApi.crear).toHaveBeenCalledWith({
      servicioId: "svc-tinte",
      empleadoId: "emp-ana",
      inicioEn: inicio17.toISOString(),
      nombreCliente: "María López",
      telefonoCliente: "5599887766",
      emailCliente: "maria@test.com",
      notas: "Alergia al amoniaco",
    }));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });

  it("el Empleado no ve el buscador de clientes (el directorio es del propietario)", () => {
    rol = "Empleado";
    const { panel } = renderizar();
    expect(within(panel).queryByLabelText("Buscar cliente")).toBeNull();
    expect(within(panel).getByLabelText(/Nombre del cliente/)).toBeInTheDocument();
  });

  it("un correo mal escrito no deja avanzar", async () => {
    const { panel } = renderizar();
    fireEvent.change(within(panel).getByLabelText(/Nombre del cliente/), { target: { value: "Luis" } });
    fireEvent.change(within(panel).getByLabelText(/Teléfono/), { target: { value: "5512345678" } });
    fireEvent.change(within(panel).getByLabelText(/Email/), { target: { value: "luis@" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Continuar" }));
    expect(await within(panel).findByText(/Correo no válido/)).toBeInTheDocument();
    expect(within(panel).getByText("Paso 1 de 4 · Cliente")).toBeInTheDocument();
  });
});

describe("NuevaCitaPanel — precarga desde un hueco (I1)", () => {
  it("trae fecha, empleado y hora del hueco, y acota los servicios a los del empleado", async () => {
    const { panel } = renderizar({ inicio: inicio16, empleadoId: "emp-beto" });
    expect(await within(panel).findByText(/Hueco elegido: .* · Beto/)).toBeInTheDocument();
    await llenarClienteYContinuar(panel);

    // Beto solo ofrece Corte.
    expect(await within(panel).findByRole("button", { name: /Corte/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Tinte/ })).toBeNull();
    fireEvent.click(within(panel).getByRole("button", { name: /Corte/ }));

    expect(within(panel).getByRole("button", { name: "Beto" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByLabelText("Fecha")).toHaveValue("2030-01-10");
    // La hora del hueco queda elegida si está libre.
    expect(await within(panel).findByRole("button", { name: "4:00 p. m." })).toHaveAttribute("aria-pressed", "true");
    expect(api.get).toHaveBeenCalledWith("/publico/disponibilidad", {
      params: { servicioId: "svc-corte", empleadoId: "emp-beto", fecha: "2030-01-10" },
    });

    fireEvent.click(within(panel).getByRole("button", { name: "Continuar" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Crear cita" }));
    await waitFor(() => expect(citasApi.crear).toHaveBeenCalledWith(
      expect.objectContaining({ servicioId: "svc-corte", empleadoId: "emp-beto", inicioEn: inicio16.toISOString() }),
    ));
  });

  it("avisa si la hora del hueco ya no está libre para el servicio y no elige otra", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ inicio: inicio17.toISOString(), horaTexto: "5:00 p. m." }] });
    const { panel } = renderizar({ inicio: inicio16, empleadoId: "emp-ana" });
    await llenarClienteYContinuar(panel);
    fireEvent.click(await within(panel).findByRole("button", { name: /Corte/ }));
    expect(await within(panel).findByText(/no están disponibles para este servicio/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "5:00 p. m." })).toHaveAttribute("aria-pressed", "false");
    expect(within(panel).getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("si la hora exacta no está, propone el siguiente horario dentro de la hora", async () => {
    // Los horarios van en pasos de la duración del servicio: 16:00 no existe, 16:15 sí.
    const inicio1615 = new Date(2030, 0, 10, 16, 15);
    vi.mocked(api.get).mockResolvedValue({ data: [
      { inicio: new Date(2030, 0, 10, 15, 30).toISOString(), horaTexto: "3:30 p. m." },
      { inicio: inicio1615.toISOString(), horaTexto: "4:15 p. m." },
    ] });
    const { panel } = renderizar({ inicio: inicio16, empleadoId: "emp-ana" });
    await llenarClienteYContinuar(panel);
    fireEvent.click(await within(panel).findByRole("button", { name: /Corte/ }));
    expect(await within(panel).findByRole("button", { name: "4:15 p. m." })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByText(/te proponemos las 4:15/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("'Ver todos los servicios' quita el filtro del empleado del hueco", async () => {
    const { panel } = renderizar({ inicio: inicio16, empleadoId: "emp-beto" });
    await llenarClienteYContinuar(panel);
    await within(panel).findByRole("button", { name: /Corte/ });
    fireEvent.click(within(panel).getByRole("button", { name: "Ver todos los servicios" }));
    expect(within(panel).getByRole("button", { name: /Tinte/ })).toBeInTheDocument();
  });
});
