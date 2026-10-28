import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ClientesPage from "./ClientesPage";

vi.mock("../../api/clientes", () => ({
  clientesApi: {
    obtenerTodos: vi.fn(),
    obtenerPorActividad: vi.fn(),
    obtenerResumenActividad: vi.fn(),
    obtenerPorId: vi.fn(),
    obtenerCitas: vi.fn().mockResolvedValue([]),
    actualizarNotas: vi.fn(),
    exportar: vi.fn(),
    actualizar: vi.fn(),
  },
}));

vi.mock("../../utils/exportarExcel", () => ({
  exportarExcel: vi.fn(() => Promise.resolve()),
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
import { exportarExcel } from "../../utils/exportarExcel";

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
    // Tarjeta (teléfono) y fila (desde sm): se muestra una u otra por CSS.
    await waitFor(() =>
      expect(within(screen.getByRole("table")).getByText("Juan Pérez")).toBeInTheDocument()
    );
  });

  it("muestra el teléfono del cliente en la tabla", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(
      paginaCon([makeCliente()])
    );
    renderConQuery();
    await waitFor(() =>
      expect(within(screen.getByRole("table")).getByText("5511223344")).toBeInTheDocument()
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
        screen.getByText(/Llegan solos con su primera reserva/i)
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

/**
 * El servidor ya devuelve cada grupo listo y paginado: la página solo pide el
 * que está seleccionado, con el umbral elegido.
 */
function mockConActividadDelServidor() {
  vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([CLIENTE_ACTIVO], 1));
  vi.mocked(clientesApi.obtenerPorActividad).mockImplementation((actividad) =>
    Promise.resolve(
      actividad === "activos"
        ? paginaCon([CLIENTE_ACTIVO, CLIENTE_FUTURO])
        : paginaCon([CLIENTE_INACTIVO])
    )
  );
  vi.mocked(clientesApi.obtenerResumenActividad).mockResolvedValue({
    total: 4,
    activos: 2,
    inactivos: 1,
    sinVisitas: 1,
  });
}

async function elegirActividad(opcion: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actividad" }));
  await user.click(screen.getByRole("option", { name: opcion }));
}

async function elegirUmbral(dias: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: `${dias} días` }));
}

describe("ClientesPage — filtro de actividad", () => {
  it("el desplegable ofrece Todos, Activos e Inactivos", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Actividad" }));
    expect(screen.getByRole("option", { name: "Todos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Activos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inactivos" })).toBeInTheDocument();
  });

  it("Activos lista a quien visitó dentro del umbral", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Ana Activa")).toBeInTheDocument()
    );
  });

  it("Activos incluye a quien ya tiene una cita agendada a futuro", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Beto Agendado")).toBeInTheDocument()
    );
    // Nunca un conteo de días en negativo para una fecha futura.
    expect(screen.queryByText(/-\d+ días/)).not.toBeInTheDocument();
  });

  it("el resumen cuadra con el directorio completo", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(
        screen.getByText(/De 4 clientes: 2 activos, 1 inactivos y 1 sin visitas registradas/)
      ).toBeInTheDocument()
    );
  });

  it("los conteos vienen del resumen, no de la página visible", async () => {
    // La página trae 2 filas; el resumen describe 640 clientes. Si los conteos
    // se calcularan sobre lo dibujado, aquí dirían 2.
    mockConActividadDelServidor();
    vi.mocked(clientesApi.obtenerResumenActividad).mockResolvedValue({
      total: 640,
      activos: 600,
      inactivos: 25,
      sinVisitas: 15,
    });
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(
        screen.getByText(/De 640 clientes: 600 activos, 25 inactivos y 15 sin visitas registradas/)
      ).toBeInTheDocument()
    );
  });

  it("nombra al grupo sin visitas en vez de descartarlo en silencio", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText(/nunca se les agendó una cita/)).toBeInTheDocument()
    );
  });

  it("el resumen sigue visible aunque el grupo elegido esté vacío", async () => {
    mockConActividadDelServidor();
    vi.mocked(clientesApi.obtenerPorActividad).mockResolvedValue(paginaCon([], 0));
    vi.mocked(clientesApi.obtenerResumenActividad).mockResolvedValue({
      total: 1,
      activos: 0,
      inactivos: 0,
      sinVisitas: 1,
    });
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(
        screen.getByText(/De 1 clientes: 0 activos, 0 inactivos y 1 sin visitas registradas/)
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/Sin clientes activos/i)).toBeInTheDocument();
  });

  it("ya no advierte de un tope de análisis", async () => {
    // El aviso ámbar solo confesaba el corte en 500. Sin corte, sería falso.
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Ana Activa")).toBeInTheDocument()
    );
    expect(screen.queryByText(/El análisis se realiza sobre/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/algunos pueden no aparecer/i)).not.toBeInTheDocument();
  });

  it("el umbral se enuncia distinto en cada modo", async () => {
    mockConActividadDelServidor();
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
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(screen.getByText("Ana Activa")).toBeInTheDocument()
    );
    expect(screen.queryByText("Reactivar")).not.toBeInTheDocument();
  });

  it("Inactivos sí ofrece reactivar", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Inactivos");
    await waitFor(() =>
      expect(screen.getAllByText("Reactivar").length).toBeGreaterThan(0)
    );
  });
});

// ── El reparto lo hace el servidor, no la memoria ─────────────────────────────

describe("ClientesPage — el reparto por actividad va al servidor", () => {
  it("cambiar de modo vuelve a consultar en vez de filtrar lo ya traído", async () => {
    mockConActividadDelServidor();
    renderConQuery();

    await elegirActividad("Activos");
    await waitFor(() =>
      expect(clientesApi.obtenerPorActividad).toHaveBeenCalledWith("activos", 60, 1, 15)
    );

    await elegirActividad("Inactivos");
    await waitFor(() =>
      expect(clientesApi.obtenerPorActividad).toHaveBeenCalledWith("inactivos", 60, 1, 15)
    );
    await waitFor(() =>
      expect(screen.getByText("Carla Inactiva")).toBeInTheDocument()
    );
    expect(screen.queryByText("Ana Activa")).not.toBeInTheDocument();
  });

  it("cambiar el umbral vuelve a consultar el listado con los días nuevos", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Inactivos");
    await waitFor(() =>
      expect(clientesApi.obtenerPorActividad).toHaveBeenCalledWith("inactivos", 60, 1, 15)
    );

    await elegirUmbral("180");
    await waitFor(() =>
      expect(clientesApi.obtenerPorActividad).toHaveBeenCalledWith("inactivos", 180, 1, 15)
    );
  });

  it("cambiar el umbral también recalcula los conteos en el servidor", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await elegirActividad("Activos");
    await waitFor(() =>
      expect(clientesApi.obtenerResumenActividad).toHaveBeenCalledWith(60)
    );

    await elegirUmbral("30");
    await waitFor(() =>
      expect(clientesApi.obtenerResumenActividad).toHaveBeenCalledWith(30)
    );
  });

  it("no pide el análisis de actividad mientras el modo es Todos", async () => {
    mockConActividadDelServidor();
    renderConQuery();
    await waitFor(() =>
      expect(clientesApi.obtenerTodos).toHaveBeenCalledWith(undefined, 1, 15)
    );
    expect(clientesApi.obtenerPorActividad).not.toHaveBeenCalled();
    expect(clientesApi.obtenerResumenActividad).not.toHaveBeenCalled();
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

describe("ClientesPage — detalle desde el teléfono y la fila (OM-10)", () => {
  it("en teléfono cada cliente es una tarjeta que abre el detalle", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([makeCliente()]));
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de Juan Pérez" }));
    expect(await screen.findByRole("dialog", { name: "Juan Pérez" })).toBeInTheDocument();
  });

  it("en escritorio toda la fila abre el detalle", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([makeCliente()]));
    renderConQuery();
    const tabla = await screen.findByRole("table");
    fireEvent.click(await within(tabla).findByText("juan@test.com"));
    expect(await screen.findByRole("dialog", { name: "Juan Pérez" })).toBeInTheDocument();
  });
});

describe("ClientesPage — notas internas", () => {
  it("guarda las notas que hay en el campo para el cliente abierto", async () => {
    const cliente = makeCliente({ notas: "Alergia al tinte" });
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([cliente]));
    vi.mocked(clientesApi.actualizarNotas).mockResolvedValue({ ...cliente, notas: "Prefiere la mañana" } as never);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de Juan Pérez" }));

    const campo = await screen.findByPlaceholderText("Preferencias, alergias, observaciones...");
    expect(campo).toHaveValue("Alergia al tinte");
    fireEvent.change(campo, { target: { value: "Prefiere la mañana" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar notas" }));

    await waitFor(() => expect(clientesApi.actualizarNotas).toHaveBeenCalledTimes(1));
    expect(clientesApi.actualizarNotas).toHaveBeenCalledWith("cli-1", "Prefiere la mañana");
    expect(await screen.findByRole("status")).toHaveTextContent("Guardado");
  });

  it("vaciar las notas las guarda como null", async () => {
    const cliente = makeCliente({ notas: "Alergia al tinte" });
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([cliente]));
    vi.mocked(clientesApi.actualizarNotas).mockResolvedValue({ ...cliente, notas: null } as never);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de Juan Pérez" }));

    fireEvent.change(await screen.findByPlaceholderText("Preferencias, alergias, observaciones..."), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar notas" }));
    await waitFor(() => expect(clientesApi.actualizarNotas).toHaveBeenCalledWith("cli-1", null));
  });
});

// ── Exportación completa (B18 / decisión 10) ───────────────────────────────────

describe("ClientesPage — exportar todo el directorio", () => {
  it("pide al servidor todas las filas, no solo la página visible", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([makeCliente()], 40));
    const todos = Array.from({ length: 40 }, (_, i) => ({
      nombreCompleto: `Cliente ${i}`, telefono: `55${i}`, email: null, totalCitas: 1,
      cantidadInasistencias: 0, ultimaCitaEn: null, fechaCreacion: "2025-01-01T00:00:00",
    }));
    vi.mocked(clientesApi.exportar).mockResolvedValue(todos);
    renderConQuery();

    const boton = await screen.findByRole("button", { name: "Exportar Excel" });
    expect(screen.queryByText(/Solo esta página/)).not.toBeInTheDocument();
    expect(screen.getByText("Todo el directorio: 40")).toBeInTheDocument();
    fireEvent.click(boton);

    await waitFor(() => expect(exportarExcel).toHaveBeenCalled());
    expect(clientesApi.exportar).toHaveBeenCalledWith(undefined);
    const [, grupos] = vi.mocked(exportarExcel).mock.calls[0];
    expect(grupos[0]).toHaveLength(40);
    expect(grupos[0][39][0]).toBe("Cliente 39");
  });

  it("si el servidor falla no genera un archivo a medias", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([makeCliente()], 1));
    vi.mocked(clientesApi.exportar).mockRejectedValue(new Error("429"));
    renderConQuery();

    fireEvent.click(await screen.findByRole("button", { name: "Exportar Excel" }));

    await waitFor(() => expect(clientesApi.exportar).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "Exportar Excel" })).not.toBeDisabled());
    expect(exportarExcel).not.toHaveBeenCalled();
  });
});

describe("ClientesPage — editar cliente", () => {
  it("la fila ofrece Historial y Editar, en ese orden", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([makeCliente()]));
    renderConQuery();
    const tabla = await screen.findByRole("table");
    const historial = await within(tabla).findByRole("button", { name: "Ver historial de Juan Pérez" });
    const editar = within(tabla).getByRole("button", { name: "Editar Juan Pérez" });
    expect(historial.compareDocumentPosition(editar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("edita nombre, teléfono y correo desde el detalle", async () => {
    const cliente = makeCliente();
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([cliente]));
    vi.mocked(clientesApi.actualizar).mockResolvedValue({ ...cliente, nombreCompleto: "Juan P. Gómez", telefono: "5599887766" } as never);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle de Juan Pérez" }));
    const detalle = await screen.findByRole("dialog", { name: "Juan Pérez" });
    // El historial vive en el detalle del cliente.
    expect(within(detalle).getByText("Historial de citas")).toBeInTheDocument();
    fireEvent.click(within(detalle).getByRole("button", { name: /Editar datos/ }));

    const form = await screen.findByRole("dialog", { name: "Editar cliente" });
    const guardar = within(form).getByRole("button", { name: "Guardar cambios" });
    expect(guardar).toBeDisabled();
    fireEvent.change(within(form).getByLabelText(/Nombre/), { target: { value: "Juan P. Gómez" } });
    fireEvent.change(within(form).getByLabelText(/Teléfono/), { target: { value: "55 9988 7766" } });
    fireEvent.click(guardar);

    await waitFor(() =>
      expect(clientesApi.actualizar).toHaveBeenCalledWith("cli-1", {
        nombreCompleto: "Juan P. Gómez",
        telefono: "55 9988 7766",
        email: "juan@test.com",
      })
    );
    expect(await screen.findByRole("dialog", { name: "Juan P. Gómez" })).toBeInTheDocument();
  });

  it("no envía un teléfono o un correo con formato inválido", async () => {
    vi.mocked(clientesApi.obtenerTodos).mockResolvedValue(paginaCon([makeCliente()]));
    renderConQuery();
    const tabla = await screen.findByRole("table");
    fireEvent.click(await within(tabla).findByRole("button", { name: "Editar Juan Pérez" }));
    const form = await screen.findByRole("dialog", { name: "Editar cliente" });
    fireEvent.change(within(form).getByLabelText(/Teléfono/), { target: { value: "12" } });
    fireEvent.change(within(form).getByLabelText(/Correo/), { target: { value: "no-es-correo" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar cambios" }));
    expect(await within(form).findByText("Entre 7 y 15 dígitos")).toBeInTheDocument();
    expect(within(form).getByText(/Correo no válido/)).toBeInTheDocument();
    expect(clientesApi.actualizar).not.toHaveBeenCalled();
  });
});
