import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import KioskPage from "./KioskPage";
import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { negociosApi } from "../../api/negocios";
import type { PaginaCitas } from "../../api/citas";
import type { EmpleadoDto } from "../../types";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn(),
  },
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerTodos: vi.fn(),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn(),
  },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: mockToast }),
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: (selector: (s: { usuario: null }) => unknown) =>
    selector({ usuario: null }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function renderKiosk() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <KioskPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const emptyCitasResponse: PaginaCitas = {
  datos: [],
  total: 0,
  pagina: 1,
  tamano: 200,
};

function makeEmpleado(overrides: Partial<EmpleadoDto> = {}): EmpleadoDto {
  return {
    id: "emp-1",
    nombre: "Ana García",
    activo: true,
    apellido: "",
    email: null,
    telefono: null,
    fotoUrl: null,
    negocioId: "neg-1",
    usuarioId: null,
    ...overrides,
  } as EmpleadoDto;
}

function makeCita(overrides: Record<string, unknown> = {}) {
  return {
    id: "cita-1",
    codigoConfirmacion: "ABC123",
    clienteId: "c-1",
    empleadoId: "emp-1",
    servicioId: "s-1",
    nombreCliente: "María López",
    telefonoCliente: "5551234567",
    emailCliente: null,
    nombreEmpleado: "Ana García",
    nombreServicio: "Corte",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    metodoPago: null,
    estadoTexto: "Pendiente",
    inicioEn: new Date(Date.now() - 60_000).toISOString(),
    finEn: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...overrides,
  };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue(emptyCitasResponse);
  vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
  vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({
    nombre: "Test Negocio",
    sector: "belleza",
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("KioskPage — empleados vacíos", () => {
  it("muestra 'No hay empleados activos' cuando la lista está vacía", async () => {
    renderKiosk();
    await screen.findByText("No hay empleados activos");
  });
});

describe("KioskPage — nombre de empleado", () => {
  it("muestra el nombre del empleado cuando hay uno activo sin citas", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([makeEmpleado()]);
    renderKiosk();
    await screen.findByText("Ana García");
  });
});

describe("KioskPage — tarjeta de cita", () => {
  it("muestra el nombre del cliente en la tarjeta de la cita", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([makeEmpleado()]);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita() as never],
      total: 1,
      pagina: 1,
      tamano: 200,
    });
    renderKiosk();
    await screen.findByText("María López");
  });
});

describe("KioskPage — barra de progreso en curso", () => {
  it("muestra un progressbar cuando la cita está en progreso", async () => {
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([makeEmpleado()]);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [
        makeCita({
          estadoTexto: "EnProceso",
          inicioEn: "2024-06-15T09:30:00Z",
          finEn: "2024-06-15T10:30:00Z",
        }) as never,
      ],
      total: 1,
      pagina: 1,
      tamano: 200,
    });
    renderKiosk();
    await screen.findByRole("progressbar");
  });
});

describe("KioskPage — enlace de salida", () => {
  it("muestra un enlace a /dashboard/citas", async () => {
    renderKiosk();
    const link = await screen.findByRole("link", { name: /Salir del modo pantalla/ });
    expect(link).toHaveAttribute("href", "/dashboard/citas");
  });
});
