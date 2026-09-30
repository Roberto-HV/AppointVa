import { describe, it, expect, vi, beforeEach } from "vitest";
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
      tamano: 50,
    }),
    obtenerResumenCobros: vi.fn().mockResolvedValue({
      totalCobrado: 0,
      totalPendiente: 280,
      citasPagadas: 0,
      totalCitas: 1,
      desglose: [],
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
      tamano: 50,
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
      tamano: 50,
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
      tamano: 50,
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

describe("cobro: filtrado en el servidor", () => {
  const citaBase = {
    codigoConfirmacion: "ABC",
    clienteId: "c1",
    empleadoId: "e1",
    servicioId: "s1",
    telefonoCliente: "555-0000",
    nombreEmpleado: "Sofía Hernández",
    nombreServicio: "Corte de dama",
    duracionMinutos: 30,
    precio: 280,
    estado: 2,
    estadoTexto: "Confirmada",
    inicioEn: "2026-07-31T11:30:00Z",
    finEn: "2026-07-31T12:00:00Z",
  };

  const ana = { ...citaBase, id: "cita-1", nombreCliente: "Ana García", pagada: false };
  // Cliente que en el bug original quedaba fuera de las 200 filas cargadas.
  const zoe = { ...citaBase, id: "cita-999", nombreCliente: "Zoe Ramírez", pagada: false };

  beforeEach(() => {
    vi.mocked(citasApi.obtenerTodas).mockReset();
    vi.mocked(citasApi.obtenerTodas).mockImplementation(async (filtros) => {
      const coincide = filtros?.busqueda
        ? [ana, zoe].filter(c =>
            c.nombreCliente.toLowerCase().includes(filtros.busqueda!.toLowerCase()))
        : [ana];
      return { datos: coincide, total: coincide.length, pagina: filtros?.pagina ?? 1, tamano: 50 };
    });
  });

  it("pide solo pendientes al servidor con el filtro por defecto", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
      expect.objectContaining({ pagada: false })
    );
  });

  it("cambiar el estado refetchea con el nuevo estado de pago", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));

    // El estado es un <Select>: hay que abrirlo antes de elegir una opción.
    await userEvent.click(screen.getByRole("button", { name: "Estado" }));
    await userEvent.click(screen.getByRole("option", { name: "Pagadas" }));
    await waitFor(() =>
      expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
        expect.objectContaining({ pagada: true })
      )
    );

    await userEvent.click(screen.getByRole("button", { name: "Estado" }));
    await userEvent.click(screen.getByRole("option", { name: "Todas" }));
    await waitFor(() =>
      expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
        expect.objectContaining({ pagada: undefined })
      )
    );
  });

  it("la búsqueda va al servidor y encuentra citas que no estaban cargadas", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    expect(screen.queryByText("Zoe Ramírez")).toBeNull();

    await userEvent.type(screen.getByLabelText("Buscar cliente"), "Zoe");

    await waitFor(
      () =>
        expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
          expect.objectContaining({ busqueda: "Zoe" })
        ),
      { timeout: 3000 }
    );
    await waitFor(() => expect(screen.getByText("Zoe Ramírez")).toBeInTheDocument());
    expect(screen.queryByText("Ana García")).toBeNull();
  });

  it("los totales salen del resumen del período, no de la página cargada", async () => {
    // La página solo trae una cita; los KPIs describen las 260 del período.
    vi.mocked(citasApi.obtenerResumenCobros).mockResolvedValue({
      totalCobrado: 9_999,
      totalPendiente: 1_234,
      citasPagadas: 130,
      totalCitas: 260,
      desglose: [],
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText("$9999.00").length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText("$1234.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("130").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/ 260").length).toBeGreaterThan(0);
  });
});
