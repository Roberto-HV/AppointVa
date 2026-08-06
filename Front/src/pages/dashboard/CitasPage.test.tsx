import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CitasPage from "./CitasPage";
import type { CitaDto } from "../../types";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn(),
    obtenerPorId: vi.fn(),
    cambiarEstado: vi.fn(),
    reagendar: vi.fn(),
    marcarPagada: vi.fn(),
    crear: vi.fn(),
    actualizarNotas: vi.fn(),
    registrarAnticipo: vi.fn().mockResolvedValue({}),
  },
  ESTADOS: {
    Pendiente: 1,
    Confirmada: 2,
    Completada: 3,
    Cancelada: 4,
    Inasistencia: 5,
  },
  METODOS_PAGO: ["Efectivo", "Tarjeta", "Transferencia"],
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerTodos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn().mockResolvedValue({ nombre: "Salón Test", moduloPagosHabilitado: false }),
  },
}));

vi.mock("../../api/intake", () => ({
  intakeApi: {
    getRespuestas: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/axios", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../utils/exportarExcel", () => ({
  exportarExcel: vi.fn(),
}));

vi.mock("../../components/dashboard/CalendarioCitas", () => ({
  default: () => <div data-testid="calendario-citas" />,
}));

vi.mock("../../components/dashboard/GanttCitas", () => ({
  default: () => <div data-testid="gantt-citas" />,
}));

vi.mock("../../components/booking/PasoFechaHora", () => ({
  default: () => <div data-testid="paso-fecha-hora" />,
}));

vi.mock("../../components/ui/EstadoBadge", () => ({
  default: ({ estado }: { estado: string }) => (
    <span data-testid="estado-badge">{estado}</span>
  ),
}));

vi.mock("../../components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/ui/Pagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock("../../components/ui/Modal", () => ({
  default: ({
    abierto,
    titulo,
    children,
  }: {
    abierto: boolean;
    titulo: string;
    children?: React.ReactNode;
    onCerrar?: () => void;
    ancho?: string;
  }) =>
    abierto ? (
      <div role="dialog" aria-label={titulo}>
        {children}
      </div>
    ) : null,
}));

vi.mock("../../components/ui/Select", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <select {...(props as object)}>{children}</select>
  ),
}));

import { citasApi } from "../../api/citas";

const makeCita = (overrides = {}) => ({
  id: "cita-1",
  nombreCliente: "Juan Pérez",
  telefonoCliente: "5511223344",
  emailCliente: "juan@test.com",
  nombreServicio: "Corte de cabello",
  nombreEmpleado: "María García",
  servicioId: "svc-1",
  empleadoId: "emp-1",
  clienteId: "cli-1",
  inicioEn: "2026-07-23T10:00:00",
  finEn: "2026-07-23T10:30:00",
  duracionMinutos: 30,
  precio: 200,
  estado: 1,
  estadoTexto: "Pendiente",
  pagada: false,
  metodoPago: null,
  notas: null,
  comprobanteUrl: null,
  codigoConfirmacion: "ABC123",
  ...overrides,
});

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <CitasPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CitasPage — estado de carga", () => {
  it("muestra el skeleton de tabla mientras se cargan las citas", async () => {
    vi.mocked(citasApi.obtenerTodas).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    await waitFor(() =>
      expect(container.querySelector(".animate-pulse")).toBeTruthy()
    );
  });
});

describe("CitasPage — estado vacío", () => {
  it("muestra el estado vacío cuando no hay citas en el rango", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("No hay citas en este rango")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — lista de citas", () => {
  it("muestra el nombre del cliente en la tabla", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 1,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    );
  });

  it("muestra el nombre del servicio en la tabla", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 1,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Corte de cabello")).toBeInTheDocument()
    );
  });

  it("muestra el badge del estado de la cita", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 1,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("estado-badge")).toBeInTheDocument()
    );
    expect(screen.getByTestId("estado-badge")).toHaveTextContent("Pendiente");
  });

  it("muestra el botón '+ Nueva cita' en el encabezado", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nueva cita" })
      ).toBeInTheDocument()
    );
  });
});

describe("CitasPage — filtros de estado", () => {
  it("muestra los botones de filtro de estado", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Pendiente/ })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /Confirmada/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completada/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelada/ })).toBeInTheDocument();
  });

  it("muestra estado vacío filtrado al filtrar por estado sin coincidencias", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Pendiente/ })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /Pendiente/ }));
    await waitFor(() =>
      expect(screen.getByText("Sin citas pendientes")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — botones de acción en filas", () => {
  it("muestra el botón Confirmar para citas Pendientes", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Pendiente" })],
      total: 1,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Confirmar/i })).toBeInTheDocument()
    );
  });

  it("muestra el botón Reagendar para citas Pendientes y Confirmadas", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Pendiente" })],
      total: 1,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reagendar/i })).toBeInTheDocument()
    );
  });
});

describe("CitasPage — tabs de vista", () => {
  it("muestra el componente de calendario al cambiar a la vista Calendario", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Calendario" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Calendario" }));
    await waitFor(() =>
      expect(screen.getByTestId("calendario-citas")).toBeInTheDocument()
    );
  });

  it("muestra el Gantt al cambiar a la vista Línea de tiempo", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Línea de tiempo" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Línea de tiempo" }));
    await waitFor(() =>
      expect(screen.getByTestId("gantt-citas")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — input de búsqueda", () => {
  it("muestra el placeholder 'Nombre o teléfono...' en el input de búsqueda", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Nombre o teléfono...")
      ).toBeInTheDocument()
    );
  });

  it("actualiza el valor al escribir en el input de búsqueda", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    const input = await screen.findByPlaceholderText("Nombre o teléfono...");
    fireEvent.change(input, { target: { value: "Juan" } });
    expect(input).toHaveValue("Juan");
  });
});

describe("CitasPage — atajo 'Hoy'", () => {
  it("establece ambas fechas al día actual al hacer clic en 'Hoy'", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    const { container } = renderConQuery();

    // Cambiar a Semana para que al menos una fecha difiera de hoy
    const btnSemana = await screen.findByRole("button", { name: "Semana" });
    fireEvent.click(btnSemana);

    // Volver a Hoy
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

    const d = new Date();
    const hoyStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs[0]).toHaveValue(hoyStr);
    expect(dateInputs[1]).toHaveValue(hoyStr);
  });
});

describe("CitasPage — paginación", () => {
  it("renderiza el componente Pagination cuando la respuesta contiene citas", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 150,
      pagina: 1,
      tamano: 50,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("pagination")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — filtro de Profesional", () => {
  it("muestra el dropdown de Profesional en la vista de lista", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 50,
    });
    const { container } = renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Profesional")).toBeInTheDocument()
    );
    expect(container.querySelector("select")).toBeInTheDocument();
  });
});


describe("anticipo badge y botón", () => {
  function renderWithCitas(citas: CitaDto[]) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: citas,
      total: citas.length,
      pagina: 1,
      tamano: 200,
    });
    return render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <CitasPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  const baseCita = {
    id: "cita-anticipo",
    codigoConfirmacion: "ANT001",
    clienteId: "c1",
    empleadoId: "e1",
    servicioId: "s1",
    nombreCliente: "Luis Pérez",
    telefonoCliente: "555-0001",
    nombreEmpleado: "Ana Gómez",
    nombreServicio: "Corte",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    estado: 2,
    estadoTexto: "Confirmada",
    inicioEn: new Date(Date.now() + 86400000).toISOString(),
    finEn: new Date(Date.now() + 86400000 + 1800000).toISOString(),
  };

  it("no muestra badge cuando anticipoRequerido es false", async () => {
    renderWithCitas([{ ...baseCita, anticipoRequerido: false }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.queryByText(/Anticipo/)).toBeNull();
  });

  it("muestra badge ámbar cuando anticipo pendiente", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: false,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.getByText("⏳ Anticipo")).toBeInTheDocument();
  });

  it("muestra badge verde cuando anticipo recibido", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: true,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.getByText("✓ Anticipo")).toBeInTheDocument();
  });

  it("muestra botón $ Anticipo cuando pendiente y no pagada", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: false,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.getByText("$ Anticipo")).toBeInTheDocument();
  });
});
