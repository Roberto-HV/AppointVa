import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PagosPage from "./PagosPage";
import { citasApi } from "../../api/citas";

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn().mockResolvedValue({
      datos: [
        {
          id: "cita-1",
          codigoConfirmacion: "ABC",
          clienteId: "c1",
          empleadoId: "e1",
          servicioId: "s1",
          nombreCliente: "Ana García",
          telefonoCliente: "555-0000",
          nombreEmpleado: "Sofía Hernández",
          nombreServicio: "Corte de dama",
          duracionMinutos: 30,
          precio: 280,
          pagada: false,
          estado: 2,
          estadoTexto: "Confirmada",
          inicioEn: "2026-07-31T11:30:00Z",
          finEn: "2026-07-31T12:00:00Z",
        },
      ],
      total: 1,
      pagina: 1,
      tamano: 200,
    }),
  },
  METODOS_PAGO: ["Efectivo", "Tarjeta", "Transferencia"],
  ESTADOS: {},
}));

vi.mock("../../api/pagos", () => ({
  pagosApi: {
    registrar: vi.fn().mockResolvedValue({
      id: "cita-1",
      codigoConfirmacion: "ABC",
      clienteId: "c1",
      empleadoId: "e1",
      servicioId: "s1",
      nombreCliente: "Ana García",
      telefonoCliente: "555-0000",
      nombreEmpleado: "Sofía Hernández",
      nombreServicio: "Corte de dama",
      duracionMinutos: 30,
      precio: 280,
      pagada: true,
      metodoPago: "Efectivo",
      montoCobrado: 280,
      montoRecibido: 300,
      cambio: 20,
      estado: 2,
      estadoTexto: "Confirmada",
      inicioEn: "2026-07-31T11:30:00Z",
      finEn: "2026-07-31T12:00:00Z",
    }),
    enviarTicketEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn().mockResolvedValue({
      id: "n1",
      slug: "salon-test",
      nombre: "Salón Test",
      activo: true,
      moduloPagosHabilitado: true,
    }),
  },
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    usuario: { rol: "Propietario", nombreCompleto: "Roberto" },
  })),
}));

vi.mock("../../components/dashboard/TicketRecibo", () => ({
  default: ({ cita }: { cita: { nombreCliente: string } }) => (
    <div data-testid="ticket-recibo">{cita.nombreCliente}</div>
  ),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PagosPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("PagosPage", () => {
  it("muestra las citas como cards", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Ana García")).toBeInTheDocument();
    });
  });

  it("botón Cobrar abre el modal de pago", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    expect(screen.getByText(/registrar pago/i)).toBeInTheDocument();
  });

  it("muestra el cálculo del cambio al ingresar monto en efectivo", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /efectivo/i }));
    const input = screen.getByPlaceholderText(/monto recibido/i);
    await userEvent.clear(input);
    await userEvent.type(input, "300");
    expect(screen.getByText(/cambio/i)).toBeInTheDocument();
    expect(screen.getByText(/\$20/)).toBeInTheDocument();
  });

  it("muestra el ticket tras confirmar el pago", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /tarjeta/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar pago/i }));
    await waitFor(() => {
      expect(screen.getByTestId("ticket-recibo")).toBeInTheDocument();
    });
  });
});

describe("anticipo en checkout", () => {
  const citaConAnticipo = {
    id: "cita-1",
    codigoConfirmacion: "ABC",
    clienteId: "c1",
    empleadoId: "e1",
    servicioId: "s1",
    nombreCliente: "Ana García",
    telefonoCliente: "555-0000",
    nombreEmpleado: "Sofía Hernández",
    nombreServicio: "Corte de dama",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    estado: 2,
    estadoTexto: "Confirmada",
    inicioEn: "2026-07-31T11:30:00Z",
    finEn: "2026-07-31T12:00:00Z",
    anticipoRequerido: true,
    anticipoRecibido: true,
    montoAnticipo: 50,
  };

  it("muestra banner verde cuando anticipo está recibido", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValueOnce({
      datos: [citaConAnticipo],
      total: 1,
      pagina: 1,
      tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <PagosPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await waitFor(() =>
      expect(screen.getByText(/anticipo registrado/i)).toBeInTheDocument()
    );
  });

  it("pre-llena el total con precio menos anticipo", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValueOnce({
      datos: [citaConAnticipo],
      total: 1,
      pagina: 1,
      tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <PagosPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await waitFor(() =>
      expect(screen.getByDisplayValue("150")).toBeInTheDocument()
    );
  });

  it("no muestra banner cuando anticipo no está recibido", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValueOnce({
      datos: [{ ...citaConAnticipo, anticipoRecibido: false }],
      total: 1,
      pagina: 1,
      tamano: 200,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <PagosPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await waitFor(() => screen.getByText(/registrar pago/i));
    expect(screen.queryByText(/anticipo registrado/i)).toBeNull();
  });
});
