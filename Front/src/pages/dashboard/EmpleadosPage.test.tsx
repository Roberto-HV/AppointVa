import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EmpleadosPage from "./EmpleadosPage";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...(rest as object)}>{children}</div>
    ),
  },
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerTodos: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    invitar: vi.fn(),
    obtenerHorario: vi.fn(),
    actualizarHorario: vi.fn(),
    obtenerBloqueos: vi.fn(),
    crearBloqueo: vi.fn(),
    eliminarBloqueo: vi.fn(),
    subirFoto: vi.fn(),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerHorarios: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn().mockResolvedValue({ datos: [], total: 0 }),
  },
  citasABusySlots: vi.fn().mockReturnValue([]),
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

vi.mock("../../components/ui/DateTimePicker", () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="date"
      data-testid="date-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  TimePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="time"
      data-testid="time-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  citasABusySlots: vi.fn().mockReturnValue([]),
}));

vi.mock("../../components/ui/Skeleton", () => ({
  SkeletonCards: ({ cantidad }: { cantidad: number }) => (
    <div data-testid="skeleton-cards">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="animate-pulse" />
      ))}
    </div>
  ),
}));

import { empleadosApi } from "../../api/empleados";

const mockEmpleado = {
  id: "emp-1",
  nombre: "María García",
  telefono: "5511223344",
  email: "maria@salon.com",
  biografia: "Especialista en cabello",
  activo: true,
  servicioIds: [],
  fotoUrl: null,
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <EmpleadosPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmpleadosPage — estado de carga", () => {
  it("muestra el skeleton mientras se obtienen los empleados", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockReturnValue(new Promise(() => {}));
    const { getByTestId } = renderConQuery();
    await waitFor(() =>
      expect(getByTestId("skeleton-cards")).toBeInTheDocument()
    );
  });
});

describe("EmpleadosPage — estado vacío", () => {
  it("muestra el estado vacío cuando no hay empleados", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Aún no tienes empleados")).toBeInTheDocument()
    );
  });

  it("muestra el botón para agregar el primer empleado en el estado vacío", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Agregar primer empleado" })
      ).toBeInTheDocument()
    );
  });
});

describe("EmpleadosPage — lista de empleados", () => {
  it("muestra el nombre del empleado", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("María García")).toBeInTheDocument()
    );
  });

  it("muestra el badge de estado Activo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Activo")).toBeInTheDocument()
    );
  });

  it("muestra el botón '+ Nuevo empleado' en el encabezado", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo empleado" })
      ).toBeInTheDocument()
    );
  });

  it("muestra el input de búsqueda cuando hay empleados", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Buscar por nombre...")
      ).toBeInTheDocument()
    );
  });

  it("filtra empleados según la búsqueda", async () => {
    const otroEmpleado = { ...mockEmpleado, id: "emp-2", nombre: "Juan Pérez" };
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado, otroEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("María García")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Buscar por nombre...");
    fireEvent.change(input, { target: { value: "Juan" } });
    await waitFor(() =>
      expect(screen.queryByText("María García")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });
});

describe("EmpleadosPage — modal de nuevo empleado", () => {
  it("abre el modal al hacer clic en '+ Nuevo empleado'", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo empleado" })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo empleado" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Nuevo empleado" })).toBeInTheDocument()
    );
  });

  it("el modal contiene el campo Nombre", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo empleado" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(screen.getByText("Nombre *")).toBeInTheDocument();
  });

  it("el modal contiene el campo Correo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo empleado" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(screen.getByText("Correo")).toBeInTheDocument();
  });
});

describe("EmpleadosPage — eliminar empleado", () => {
  it("llama a eliminar al confirmar en el modal de confirmación", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.eliminar).mockResolvedValue();
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("María García")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Eliminar empleado" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
    await waitFor(() =>
      expect(vi.mocked(empleadosApi.eliminar)).toHaveBeenCalledWith("emp-1")
    );
  });
});
