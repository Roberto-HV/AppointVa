import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClientesPage from "./ClientesPage";

vi.mock("../../api/clientes", () => ({
  clientesApi: {
    obtenerTodos: vi.fn(),
    obtenerPorId: vi.fn(),
    obtenerCitas: vi.fn().mockResolvedValue([]),
    actualizarNotas: vi.fn(),
  },
}));

vi.mock("../../utils/exportarExcel", () => ({
  exportarExcel: vi.fn(),
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: vi.fn() }),
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

vi.mock("../../components/ui/EstadoBadge", () => ({
  default: ({ estado }: { estado: string }) => (
    <span data-testid="estado-badge">{estado}</span>
  ),
}));

vi.mock("../../components/ui/Pagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

import { clientesApi } from "../../api/clientes";

const makeCliente = (overrides: Record<string, unknown> = {}) => ({
  id: "cli-1",
  nombreCompleto: "Juan Pérez",
  telefono: "5511223344",
  email: "juan@test.com",
  notas: null,
  totalCitas: 3,
  cantidadInasistencias: 0,
  ultimaCitaEn: "2026-07-01T10:00:00",
  fechaCreacion: "2025-01-01T00:00:00",
  ...overrides,
});

const paginaVacia = { datos: [], total: 0 };
const paginaCon = (clientes: ReturnType<typeof makeCliente>[], total?: number) => ({
  datos: clientes,
  total: total ?? clientes.length,
});

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ClientesPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clientesApi.obtenerCitas).mockResolvedValue([]);
});

// ── Estado de carga ────────────────────────────────────────────────────────────

describe("ClientesPage — estado de carga", () => {
  it("muestra texto de carga mientras la API está pendiente", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Cargando clientes...")).toBeInTheDocument()
    );
  });
});

// ── Lista de clientes ──────────────────────────────────────────────────────────

describe("ClientesPage — lista de clientes", () => {
  it("muestra el nombre del cliente cuando la API retorna resultados", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(
      paginaCon([makeCliente()])
    );
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    );
  });

  it("muestra el teléfono del cliente en la tabla", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(
      paginaCon([makeCliente()])
    );
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("5511223344")).toBeInTheDocument()
    );
  });

  it("muestra el contador de clientes sobre la tabla", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(
      paginaCon([makeCliente()], 1)
    );
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("1 cliente")).toBeInTheDocument()
    );
  });
});

// ── Estado vacío ──────────────────────────────────────────────────────────────

describe("ClientesPage — estado vacío sin búsqueda", () => {
  it("muestra 'Aún no hay clientes' cuando la API retorna arreglo vacío", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Aún no hay clientes")).toBeInTheDocument()
    );
  });

  it("muestra el mensaje explicativo del estado vacío", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByText(/aparecerán aquí automáticamente/i)
      ).toBeInTheDocument()
    );
  });
});

describe("ClientesPage — estado vacío después de búsqueda", () => {
  it("muestra 'Sin resultados' cuando la búsqueda no tiene coincidencias", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Buscar por nombre o teléfono...")
      ).toBeInTheDocument()
    );
    fireEvent.change(
      screen.getByPlaceholderText("Buscar por nombre o teléfono..."),
      { target: { value: "Inexistente" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(screen.getByText("Sin resultados")).toBeInTheDocument()
    );
  });
});

// ── Buscador ───────────────────────────────────────────────────────────────────

describe("ClientesPage — buscador", () => {
  it("renderiza el input con el placeholder correcto", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    expect(
      screen.getByPlaceholderText("Buscar por nombre o teléfono...")
    ).toBeInTheDocument();
  });

  it("actualiza el valor del input al escribir", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    const input = screen.getByPlaceholderText("Buscar por nombre o teléfono...");
    fireEvent.change(input, { target: { value: "Ana" } });
    expect(input).toHaveValue("Ana");
  });

  it("llama a la API con el término de búsqueda al hacer clic en Buscar", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith(undefined, 1, 15)
    );
    const input = screen.getByPlaceholderText("Buscar por nombre o teléfono...");
    fireEvent.change(input, { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith("Ana", 1, 15)
    );
  });

  it("llama a la API con el término de búsqueda al presionar Enter", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    const input = screen.getByPlaceholderText("Buscar por nombre o teléfono...");
    await userEvent.type(input, "María{Enter}");
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith("María", 1, 15)
    );
  });

  it("no consulta mientras se teclea: solo al confirmar", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith(undefined, 1, 15)
    );
    vi.mocked(clientesApi.obtenerTodos).mockClear();
    const input = screen.getByPlaceholderText("Buscar por nombre o teléfono...");
    await userEvent.type(input, "Carlos");
    expect(clientesApi.obtenerTodos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith("Carlos", 1, 15)
    );
  });

  it("borrar vacía el campo y restablece la búsqueda sin confirmar", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaVacia);
    renderConQuery();
    const input = screen.getByPlaceholderText("Buscar por nombre o teléfono...");
    fireEvent.change(input, { target: { value: "Carlos" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith("Carlos", 1, 15)
    );

    fireEvent.click(screen.getByRole("button", { name: /^Borrar buscar/i }));
    expect(input).toHaveValue("");
    // Vaciar se aplica solo: no hace falta volver a pulsar "Buscar".
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenLastCalledWith(undefined, 1, 15)
    );
  });
});

// ── Filtro de actividad ────────────────────────────────────────────────────────

const DIA = 24 * 60 * 60 * 1000;
const haceDias = (d: number) => new Date(Date.now() - d * DIA).toISOString();

const CLIENTE_ACTIVO = makeCliente({
  id: "act-1",
  nombreCompleto: "Ana Activa",
  ultimaCitaEn: haceDias(10),
});
const CLIENTE_FUTURO = makeCliente({
  id: "fut-1",
  nombreCompleto: "Beto Agendado",
  ultimaCitaEn: haceDias(-5), // cita ya reservada para dentro de 5 días
});
const CLIENTE_INACTIVO = makeCliente({
  id: "ina-1",
  nombreCompleto: "Carla Inactiva",
  ultimaCitaEn: haceDias(200),
});
const CLIENTE_SIN_VISITAS = makeCliente({
  id: "sin-1",
  nombreCompleto: "Diego Sin Citas",
  totalCitas: 0,
  ultimaCitaEn: null,
});

const BASE_ACTIVIDAD = [
  CLIENTE_ACTIVO,
  CLIENTE_FUTURO,
  CLIENTE_INACTIVO,
  CLIENTE_SIN_VISITAS,
];

/** La página pide 500 para el análisis de actividad y 30 para el listado. */
function mockConBaseDeActividad() {
  vi.mocked(clientesApi.obtenerTodos).mockImplementation((_q, _p, tamano) =>
    Promise.resolve(
      tamano === 500 ? paginaCon(BASE_ACTIVIDAD) : paginaCon([CLIENTE_ACTIVO], 1)
    )
  );
}

async function elegirActividad(opcion: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actividad" }));
  await user.click(screen.getByRole("option", { name: opcion }));
}

describe("ClientesPage — filtro de actividad", () => {
  it("el desplegable ofrece Todos, Activos e Inactivos", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actividad" }));
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Activos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inactivos" })).toBeInTheDocument();
  });

  it("Activos lista a quien visitó dentro del umbral", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Ana Activa")).toBeInTheDocument()
    );
  });

  it("Activos incluye a quien ya tiene una cita agendada a futuro", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Beto Agendado")).toBeInTheDocument()
    );
    // Nunca un conteo de días en negativo para una fecha futura.
    expect(screen.queryByText(/-\d+ días/)).not.toBeInTheDocument();
  });

  it("Activos excluye al inactivo y a quien nunca agendó", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Ana Activa")).toBeInTheDocument()
    );
    expect(screen.queryByText("Carla Inactiva")).not.toBeInTheDocument();
    expect(screen.queryByText("Diego Sin Citas")).not.toBeInTheDocument();
  });

  it("Inactivos sigue excluyendo a quien nunca agendó", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Inactivos");
    await waitFor(() =>
      expect(screen.getByText("Carla Inactiva")).toBeInTheDocument()
    );
    expect(screen.queryByText("Diego Sin Citas")).not.toBeInTheDocument();
  });

  it("el resumen cuadra con el total analizado", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(
        screen.getByText(/De 4 analizados: 2 activos, 1 inactivos y 1 sin visitas registradas/)
      ).toBeInTheDocument()
    );
  });

  it("nombra al grupo sin visitas en vez de descartarlo en silencio", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText(/nunca se les agendó una cita/)).toBeInTheDocument()
    );
  });

  it("el resumen sigue visible aunque el grupo elegido esté vacío", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockImplementation((_q, _p, tamano) =>
      Promise.resolve(
        tamano === 500
          ? paginaCon([CLIENTE_SIN_VISITAS])
          : paginaCon([CLIENTE_SIN_VISITAS], 1)
      )
    );
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(
        screen.getByText(/De 1 analizados: 0 activos, 0 inactivos y 1 sin visitas registradas/)
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/Sin clientes activos/i)).toBeInTheDocument();
  });

  it("el umbral se enuncia distinto en cada modo", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Con visita en los últimos")).toBeInTheDocument()
    );
    expect(screen.queryByText("Sin visitar en")).not.toBeInTheDocument();

    await elegirActividad("Inactivos");
    await waitFor(() =>
      expect(screen.getByText("Sin visitar en")).toBeInTheDocument()
    );
    expect(screen.queryByText("Con visita en los últimos")).not.toBeInTheDocument();
  });

  it("no ofrece reactivar a un cliente activo", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Ana Activa")).toBeInTheDocument()
    );
    expect(screen.queryByText("Reactivar")).not.toBeInTheDocument();
  });

  it("Inactivos sí ofrece reactivar", async () => {
    mockConBaseDeActividad();
    renderConQuery();
    await elegirActividad("Inactivos");
    await waitFor(() =>
      expect(screen.getAllByText("Reactivar").length).toBeGreaterThan(0)
    );
  });
});

// ── Paginación ─────────────────────────────────────────────────────────────────

describe("ClientesPage — paginación", () => {
  it("renderiza el componente Pagination cuando hay clientes", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(
      paginaCon([makeCliente()], 45)
    );
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("pagination")).toBeInTheDocument()
    );
  });
});

// ── Error de API ───────────────────────────────────────────────────────────────

describe("ClientesPage — error de API", () => {
  it("muestra el estado vacío sin lanzar excepción cuando la API falla", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockRejectedValue(
      new Error("Error de red")
    );
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Aún no hay clientes")).toBeInTheDocument()
    );
  });
});
