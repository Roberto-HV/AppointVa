import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PagosPage from "./PagosPage";
import { citasApi } from "../../api/citas";
import { pagosApi } from "../../api/pagos";
import { cierreCajaApi } from "../../api/cierreCaja";

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
      tamano: 15,
    }),
    obtenerResumenCobros: vi.fn().mockResolvedValue({
      totalCobrado: 0,
      totalPendiente: 280,
      citasPagadas: 0,
      totalCitas: 1,
      desglose: [],
    }),
    obtenerHistorialPagos: vi.fn().mockResolvedValue([]),
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

vi.mock("../../api/cierreCaja", () => ({
  cierreCajaApi: {
    obtener: vi.fn().mockResolvedValue({
      fecha: "2026-07-31", efectivoInicial: 0, efectivoContado: 0, efectivoCobrado: 0,
      totalRetiros: 0, efectivoEsperado: 0, diferencia: 0, retiros: [], cerradoEn: null,
    }),
    guardar: vi.fn(),
  },
}));

const rolActual = vi.hoisted(() => ({ rol: "Propietario" }));
vi.mock("../../store/authStore", () => ({
  // Respeta el selector, como el store real (usePermisos lee solo el rol).
  useAuthStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const estado = { usuario: { rol: rolActual.rol, nombreCompleto: "Roberto" } };
    return selector ? selector(estado) : estado;
  }),
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

  it("los campos del pago tienen etiqueta y 'Dividir pago' es un interruptor con nombre (DC-19)", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Ana García"));
    await userEvent.click(screen.getByRole("button", { name: /cobrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /efectivo/i }));
    expect(screen.getByRole("button", { name: /efectivo/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Monto recibido")).toBeInTheDocument();
    expect(screen.getByLabelText("Propina (opcional)")).toBeInTheDocument();
    const dividir = screen.getByRole("switch", { name: "Dividir pago" });
    await userEvent.click(dividir);
    expect(dividir).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Segundo método")).toBeInTheDocument();
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
      tamano: 15,
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
      tamano: 15,
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
      tamano: 15,
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

    // La búsqueda se confirma; ya no hay debounce que la dispare al teclear.
    await userEvent.type(screen.getByLabelText("Buscar cliente"), "Zoe{Enter}");

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
      expect(screen.getAllByText("$9,999").length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText("$1,234").length).toBeGreaterThan(0);
    expect(screen.getAllByText("130").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/ 260").length).toBeGreaterThan(0);
  });
});

describe("cobro: revertir y errores", () => {
  const pagada = {
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
    montoCobrado: 450,
    pagada: true,
    metodoPago: "Efectivo",
    estado: 3,
    estadoTexto: "Completada",
    inicioEn: "2026-07-31T11:30:00Z",
    finEn: "2026-07-31T12:00:00Z",
  };

  beforeEach(() => {
    vi.mocked(pagosApi.registrar).mockClear();
  });

  it("revertir un pago pide confirmación con el monto y el cliente antes de llamar al servidor", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [pagada], total: 1, pagina: 1, tamano: 15 });
    renderPage();
    const revertir = await screen.findByRole("button", { name: "Revertir pago de Ana García" });
    // Texto visible y objetivo táctil de 44px (antes: icono de 21px con title).
    expect(revertir).toHaveTextContent("Revertir");
    expect(revertir.className).toContain("min-h-[44px]");

    await userEvent.click(revertir);
    const dialogo = await screen.findByRole("dialog", { name: "Revertir pago" });
    expect(dialogo).toHaveTextContent("$450");
    expect(dialogo).toHaveTextContent("Ana García");
    expect(dialogo).toHaveTextContent(/corte del día cambiará/);
    expect(pagosApi.registrar).not.toHaveBeenCalled();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Volver" }));
    expect(pagosApi.registrar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Revertir pago de Ana García" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "Revertir pago" })).getByRole("button", { name: "Revertir pago" }));
    await waitFor(() => expect(pagosApi.registrar).toHaveBeenCalledWith("cita-1", { pagada: false }));
  });

  it("si el pago falla, el modal muestra el error del servidor y conserva los datos", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [{ ...pagada, pagada: false, metodoPago: null, montoCobrado: null }],
      total: 1, pagina: 1, tamano: 15,
    });
    vi.mocked(pagosApi.registrar).mockRejectedValueOnce({ response: { data: { mensaje: "La cita ya fue cobrada" } } });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /cobrar/i }));
    await userEvent.click(screen.getByRole("button", { name: /tarjeta/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirmar pago/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La cita ya fue cobrada");
    // Sigue en el modal, con el método elegido.
    expect(screen.getByText(/registrar pago/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar pago/i })).toBeEnabled();
    expect(screen.queryByTestId("ticket-recibo")).toBeNull();
  });
});

describe("corte: cierre de caja", () => {
  beforeEach(() => {
    vi.mocked(citasApi.obtenerHistorialPagos).mockResolvedValue([]);
  });

  it("guardar el cierre confirma con la hora; si falla, muestra el error", async () => {
    vi.mocked(cierreCajaApi.guardar)
      .mockRejectedValueOnce({ response: { data: { mensaje: "Sin conexión con el servidor" } } })
      .mockResolvedValueOnce({
        fecha: "2026-07-31", efectivoInicial: 100, efectivoContado: 100, efectivoCobrado: 0,
        totalRetiros: 0, efectivoEsperado: 100, diferencia: 0, retiros: [], cerradoEn: "2026-07-31T23:00:00Z",
      });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Corte del día" }));
    const guardar = await screen.findByRole("button", { name: "Guardar cierre" });

    await userEvent.click(guardar);
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión con el servidor");

    await userEvent.click(guardar);
    expect(await screen.findByRole("status")).toHaveTextContent(/Cierre guardado ·/);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("corte: el estado guardado no miente tras editar (B3)", () => {
  beforeEach(() => {
    vi.mocked(citasApi.obtenerHistorialPagos).mockResolvedValue([]);
  });

  it("al editar efectivo inicial, contado o retiros después de guardar, deja de decir 'Cierre guardado'", async () => {
    vi.mocked(cierreCajaApi.guardar).mockResolvedValue({
      fecha: "2026-07-31", efectivoInicial: 100, efectivoContado: 100, efectivoCobrado: 0,
      totalRetiros: 0, efectivoEsperado: 100, diferencia: 0, retiros: [], cerradoEn: "2026-07-31T23:00:00Z",
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Corte del día" }));
    await userEvent.click(await screen.findByRole("button", { name: "Guardar cierre" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/Cierre guardado ·/);

    await userEvent.type(screen.getByLabelText("Efectivo contado"), "5");
    expect(screen.getByRole("status")).toHaveTextContent("Cambios sin guardar en el cierre.");
    expect(screen.getByRole("status")).not.toHaveTextContent(/Cierre guardado/);

    await userEvent.click(screen.getByRole("button", { name: "Actualizar cierre" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Cierre guardado ·/));

    await userEvent.type(screen.getByLabelText("Concepto del retiro"), "Cambio");
    await userEvent.type(screen.getByLabelText("Monto del retiro"), "20");
    await userEvent.click(screen.getByRole("button", { name: "+ Agregar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cambios sin guardar en el cierre.");
  });
});

describe("Empleado: rol restringido (DC-14, decisión 2)", () => {
  const pagada = {
    id: "cita-1", codigoConfirmacion: "ABC", clienteId: "c1", empleadoId: "e1", servicioId: "s1",
    nombreCliente: "Ana García", telefonoCliente: "555-0000", nombreEmpleado: "Sofía Hernández",
    nombreServicio: "Corte de dama", duracionMinutos: 30, precio: 280, montoCobrado: 280, pagada: true,
    metodoPago: "Efectivo", estado: 3, estadoTexto: "Completada",
    inicioEn: "2026-07-31T11:30:00Z", finEn: "2026-07-31T12:00:00Z",
  };

  beforeEach(() => { rolActual.rol = "Empleado"; });
  afterEach(() => { rolActual.rol = "Propietario"; });

  it("puede cobrar, pero no ve Corte del día ni Revertir", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [pagada], total: 1, pagina: 1, tamano: 15 });
    renderPage();
    await screen.findByText("Ana García");
    expect(screen.getByRole("button", { name: "Cobro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Historial" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Corte del día" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revertir pago/ })).not.toBeInTheDocument();
  });

  it("en Historial no puede exportar a Excel", async () => {
    vi.mocked(citasApi.obtenerHistorialPagos).mockResolvedValue([pagada] as never);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Historial" }));
    await screen.findByText("Ana García");
    expect(screen.queryByRole("button", { name: /Exportar Excel/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revertir pago/ })).not.toBeInTheDocument();
  });

  it("el Propietario sí ve Corte del día", async () => {
    rolActual.rol = "Propietario";
    renderPage();
    expect(await screen.findByRole("button", { name: "Corte del día" })).toBeInTheDocument();
  });
});
