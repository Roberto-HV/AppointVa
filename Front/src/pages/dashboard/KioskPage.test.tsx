import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import KioskPage from "./KioskPage";

// Mismo intervalo que el sondeo de la página.
const INTERVALO_SONDEO_MS = 30_000;
import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { negociosApi } from "../../api/negocios";
import type { PaginaCitas } from "../../api/citas";
import type { EmpleadoDto } from "../../types";
import { authApi } from "../../api/auth";
import { AxiosError, AxiosHeaders } from "axios";

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
  useAuthStore: (selector: (s: { usuario: { email: string; rol: string } }) => unknown) =>
    selector({ usuario: { email: "dueno@negocio.mx", rol: "Propietario" } }),
}));

vi.mock("../../api/auth", () => ({
  authApi: { login: vi.fn(), logout: vi.fn().mockResolvedValue(undefined) },
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => mockNavigate,
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
    // Solo nombre e inicial del apellido: la pantalla se ve desde la sala (DC-28).
    await screen.findByText("María L.");
    expect(screen.queryByText("María López")).not.toBeInTheDocument();
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

describe("KioskPage — salida protegida (DC-13)", () => {
  const error401 = () =>
    new AxiosError("401", "ERR", undefined, undefined, {
      status: 401, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: {},
    });

  async function abrirSalida() {
    renderKiosk();
    const boton = await screen.findByRole("button", { name: /Salir del modo pantalla/ });
    expect(boton).toHaveAccessibleDescription("Mantén presionado para salir");
    fireEvent.pointerDown(boton);
    act(() => { vi.advanceTimersByTime(1500); });
    return screen.findByRole("dialog", { name: "Salir del modo recepción" });
  }

  it("ya no es un enlace directo y una pulsación corta no abre nada", async () => {
    renderKiosk();
    const boton = await screen.findByRole("button", { name: /Salir del modo pantalla/ });
    expect(screen.queryByRole("link", { name: /Salir/ })).not.toBeInTheDocument();
    fireEvent.pointerDown(boton);
    act(() => { vi.advanceTimersByTime(800); });
    fireEvent.pointerUp(boton);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mantener Enter 1.5 s con el botón enfocado abre la verificación", async () => {
    renderKiosk();
    const boton = await screen.findByRole("button", { name: /Salir del modo pantalla/ });
    boton.focus();
    fireEvent.keyDown(boton, { key: "Enter" });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(await screen.findByRole("dialog", { name: "Salir del modo recepción" })).toBeInTheDocument();
  });

  it("una contraseña incorrecta muestra un error y no sale", async () => {
    vi.mocked(authApi.login).mockRejectedValue(error401());
    const dialogo = await abrirSalida();
    fireEvent.change(within(dialogo).getByLabelText("Contraseña"), { target: { value: "mala" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Contraseña incorrecta.");
    expect(authApi.login).toHaveBeenCalledWith("dueno@negocio.mx", "mala");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("con la contraseña correcta revoca la sesión nueva y vuelve a Citas", async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: "t", refreshToken: "r-nuevo" } as never);
    const dialogo = await abrirSalida();
    fireEvent.change(within(dialogo).getByLabelText("Contraseña"), { target: { value: "buena" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard/citas"));
    expect(authApi.logout).toHaveBeenCalledWith("r-nuevo");
  });
});

describe("KioskPage — carga y conexión (DC-28)", () => {
  it("mientras carga dice que está cargando, no 'No hay empleados activos'", async () => {
    vi.mocked(citasApi.obtenerTodas).mockReturnValue(new Promise(() => {}));
    renderKiosk();
    expect(await screen.findByText(/Cargando .* de hoy…/)).toBeInTheDocument();
    expect(screen.queryByText("No hay empleados activos")).toBeNull();
  });

  it("un fallo de red avisa 'Sin conexión · reintentando' en vez de parecer un día vacío", async () => {
    vi.mocked(citasApi.obtenerTodas).mockRejectedValue(new Error("red"));
    renderKiosk();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión · reintentando");
    expect(screen.queryByText("No hay empleados activos")).toBeNull();
  });
});

describe("KioskPage — recuperación de empleados", () => {
  it("vuelve a pedir los empleados tras un fallo y el aviso desaparece solo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockRejectedValueOnce(new Error("red"));
    renderKiosk();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión · reintentando");

    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([makeEmpleado()]);
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS); });

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sin nada cargado ofrece 'Reintentar' a mano", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockRejectedValueOnce(new Error("red"));
    renderKiosk();
    const boton = await screen.findByRole("button", { name: "Reintentar" });
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([makeEmpleado()]);
    fireEvent.click(boton);
    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
