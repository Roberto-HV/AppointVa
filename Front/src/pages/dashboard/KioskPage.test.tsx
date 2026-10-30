import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import KioskPage from "./KioskPage";
import { kioscoApi, type AgendaKiosco, type CitaKiosco } from "../../api/kiosco";
import { authApi } from "../../api/auth";

// Mismo intervalo que el sondeo de la página.
const INTERVALO_SONDEO_MS = 30_000;

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

interface EstadoAuth {
  token: string | null;
  refreshToken: string | null;
  usuario: { email: string; rol: string } | null;
}

// Store mínimo y reactivo: la página cambia de sesión y debe volver a pintarse.
const auth = vi.hoisted(() => {
  let estado: EstadoAuth = { token: null, refreshToken: null, usuario: null };
  const oyentes = new Set<() => void>();
  return {
    leer: () => estado,
    poner: (parcial: Partial<EstadoAuth>) => {
      estado = { ...estado, ...parcial };
      oyentes.forEach((o) => o());
    },
    suscribir: (o: () => void) => {
      oyentes.add(o);
      return () => { oyentes.delete(o); };
    },
  };
});
const mockIniciarSesion = vi.hoisted(() => vi.fn());
const mockIniciarSesionKiosco = vi.hoisted(() => vi.fn());

vi.mock("../../store/authStore", async () => {
  const { useSyncExternalStore } = await import("react");
  const useAuthStore = Object.assign(
    <T,>(selector: (s: EstadoAuth) => T) => useSyncExternalStore(auth.suscribir, () => selector(auth.leer())),
    {
      getState: () => ({
        ...auth.leer(),
        iniciarSesion: mockIniciarSesion,
        iniciarSesionKiosco: mockIniciarSesionKiosco,
      }),
    }
  );
  return { useAuthStore };
});

vi.mock("../../api/kiosco", () => ({
  kioscoApi: { iniciar: vi.fn(), agenda: vi.fn(), salir: vi.fn() },
}));

vi.mock("../../api/auth", () => ({
  authApi: { verificar2FA: vi.fn() },
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

/**
 * `confirmada`: llega como desde el menú o Citas, con la entrada ya confirmada
 * (I6). Con la sesión de kiosco ya activa no hace falta la marca.
 */
function renderKiosk(confirmada = false) {
  const entrada = { pathname: "/dashboard/kiosk", state: confirmada ? { recepcionConfirmada: true } : null };
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[entrada]}>
        <KioskPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const USUARIO_KIOSCO = { email: "dueno@negocio.mx", rol: "Kiosco" };

function makeCita(overrides: Partial<CitaKiosco> = {}): CitaKiosco {
  return {
    id: "cita-1",
    empleadoId: "emp-1",
    nombreCliente: "María López",
    nombreServicio: "Corte",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    estadoTexto: "Pendiente",
    inicioEn: new Date(Date.now() - 60_000).toISOString(),
    finEn: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...overrides,
  };
}

function agenda(overrides: Partial<AgendaKiosco> = {}): AgendaKiosco {
  return {
    nombreNegocio: "Test Negocio",
    sector: "belleza",
    mostrarIngresos: true,
    empleados: [],
    citas: [],
    ...overrides,
  };
}

const ANA = { id: "emp-1", nombre: "Ana García" };

function errorHttp(status: number, data: unknown = {}) {
  return new AxiosError(String(status), "ERR", undefined, undefined, {
    status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data,
  });
}

const contrasenaIncorrecta = (intentosRestantes: number) =>
  errorHttp(400, { codigoError: "CONTRASENA_INCORRECTA", intentosRestantes });

const demasiadosIntentos = (reintentarEnSegundos = 300) =>
  errorHttp(429, { codigoError: "DEMASIADOS_INTENTOS", reintentarEnSegundos });

const sesionDueno = {
  token: "t-dueno",
  refreshToken: "r-nuevo",
  tokenExpiracion: "",
  usuario: { id: "u-1", email: "dueno@negocio.mx", nombreCompleto: "Dueña", rol: "Propietario", negocioId: "n-1" },
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  sessionStorage.clear();
  auth.poner({ token: "t-kiosco", refreshToken: null, usuario: USUARIO_KIOSCO });
  mockIniciarSesionKiosco.mockImplementation((token: string, usuario: EstadoAuth["usuario"]) =>
    auth.poner({ token, refreshToken: null, usuario }));
  vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda());
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("KioskPage — entrar al modo recepción (B9)", () => {
  it("cambia la sesión del dueño por un token de kiosco sin refresh token", async () => {
    auth.poner({ token: "t-dueno", refreshToken: "r-dueno", usuario: { email: "dueno@negocio.mx", rol: "Propietario" } });
    vi.mocked(kioscoApi.iniciar).mockResolvedValue({
      token: "t-kiosco", tokenExpiracion: "", usuario: USUARIO_KIOSCO as never,
    });

    renderKiosk(true);

    expect(screen.getByRole("status")).toHaveTextContent("Activando modo recepción…");
    await screen.findByText("No hay empleados activos");
    expect(kioscoApi.iniciar).toHaveBeenCalledTimes(1);
    expect(kioscoApi.iniciar).toHaveBeenCalledWith("r-dueno");
    expect(mockIniciarSesionKiosco).toHaveBeenCalledWith("t-kiosco", USUARIO_KIOSCO);
    expect(auth.leer().refreshToken).toBeNull();
    // La agenda se pide ya con el token de kiosco, nunca con la sesión del dueño.
    expect(kioscoApi.agenda).toHaveBeenCalled();
  });

  it("si no se puede activar lo dice y deja volver al panel o reintentar", async () => {
    auth.poner({ token: "t-dueno", refreshToken: "r-dueno", usuario: { email: "dueno@negocio.mx", rol: "Propietario" } });
    vi.mocked(kioscoApi.iniciar).mockRejectedValueOnce(new Error("red"));

    renderKiosk(true);

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo activar el modo recepción.");
    expect(kioscoApi.agenda).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver al panel" }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/citas");

    vi.mocked(kioscoApi.iniciar).mockResolvedValue({ token: "t-kiosco", tokenExpiracion: "", usuario: USUARIO_KIOSCO as never });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("No hay empleados activos");
    expect(kioscoApi.iniciar).toHaveBeenCalledTimes(2);
  });
});

describe("KioskPage — confirmación al entrar (I6)", () => {
  beforeEach(() => {
    auth.poner({ token: "t-dueno", refreshToken: "r-dueno", usuario: { email: "dueno@negocio.mx", rol: "Propietario" } });
    vi.mocked(kioscoApi.iniciar).mockResolvedValue({
      token: "t-kiosco", tokenExpiracion: "", usuario: USUARIO_KIOSCO as never,
    });
  });

  it("sin confirmar (URL escrita) pregunta antes y no cambia la sesión", async () => {
    renderKiosk(false);

    const dialogo = await screen.findByRole("dialog", { name: "¿Activar el modo recepción?" });
    expect(dialogo).toHaveTextContent("Para volver al panel tendrás que escribir la contraseña de tu cuenta");
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(kioscoApi.iniciar).not.toHaveBeenCalled();
    expect(auth.leer().refreshToken).toBe("r-dueno");

    fireEvent.click(within(dialogo).getByRole("button", { name: "Volver" }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/citas", { replace: true });
    expect(kioscoApi.iniciar).not.toHaveBeenCalled();
  });

  it("al confirmar ahí mismo entra al modo recepción", async () => {
    renderKiosk(false);

    const dialogo = await screen.findByRole("dialog", { name: "¿Activar el modo recepción?" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Activar recepción" }));

    await screen.findByText("No hay empleados activos");
    expect(kioscoApi.iniciar).toHaveBeenCalledTimes(1);
  });

  it("la marca de confirmación se borra del historial al leerla", async () => {
    renderKiosk(true);
    await screen.findByText("No hay empleados activos");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/kiosk", { replace: true, state: null });
  });
});

describe("KioskPage — agenda", () => {
  it("muestra 'No hay empleados activos' cuando la lista está vacía", async () => {
    renderKiosk();
    await screen.findByText("No hay empleados activos");
  });

  it("muestra el nombre del negocio y del empleado sin citas", async () => {
    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({ empleados: [ANA] }));
    renderKiosk();
    await screen.findByText("Ana García");
    expect(screen.getByText("Test Negocio")).toBeInTheDocument();
  });

  it("muestra solo nombre e inicial del cliente (DC-28)", async () => {
    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({ empleados: [ANA], citas: [makeCita()] }));
    renderKiosk();
    await screen.findByText("María L.");
    expect(screen.queryByText("María López")).not.toBeInTheDocument();
  });

  it("muestra un progressbar cuando la cita está en progreso", async () => {
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({
      empleados: [ANA],
      citas: [makeCita({ estadoTexto: "EnProceso", inicioEn: "2024-06-15T09:30:00Z", finEn: "2024-06-15T10:30:00Z" })],
    }));
    renderKiosk();
    await screen.findByRole("progressbar");
  });

  it("los ingresos del día solo aparecen si el servidor lo permite", async () => {
    const citas = [makeCita({ pagada: true, precio: 350 })];
    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({ empleados: [ANA], citas, mostrarIngresos: false }));
    renderKiosk();
    await screen.findByText("María L.");
    expect(screen.queryByText(/generado/)).not.toBeInTheDocument();
    cleanup();

    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({ empleados: [ANA], citas, mostrarIngresos: true }));
    renderKiosk();
    expect(await screen.findByText(/generado/)).toBeInTheDocument();
  });
});

describe("KioskPage — salida protegida (DC-13, B9)", () => {
  async function abrirSalida() {
    renderKiosk();
    const boton = await screen.findByRole("button", { name: /Salir del modo pantalla/ });
    expect(boton).toHaveAccessibleDescription("Mantén presionado para salir");
    fireEvent.pointerDown(boton);
    act(() => { vi.advanceTimersByTime(1500); });
    return screen.findByRole("dialog", { name: "Salir del modo recepción" });
  }

  function enviarContrasena(dialogo: HTMLElement, valor: string) {
    fireEvent.change(within(dialogo).getByLabelText("Contraseña"), { target: { value: valor } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
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

  it("una contraseña incorrecta muestra los intentos que da el servidor y no sale", async () => {
    vi.mocked(kioscoApi.salir).mockRejectedValue(contrasenaIncorrecta(2));
    const dialogo = await abrirSalida();
    enviarContrasena(dialogo, "mala");
    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta).toHaveTextContent("Contraseña incorrecta. Quedan 2 intentos");
    expect(kioscoApi.salir).toHaveBeenCalledWith("mala");
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockIniciarSesion).not.toHaveBeenCalled();
  });

  it("con la contraseña correcta guarda la sesión normal y vuelve a Citas", async () => {
    vi.mocked(kioscoApi.salir).mockResolvedValue(sesionDueno as never);
    const dialogo = await abrirSalida();
    enviarContrasena(dialogo, "buena");
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard/citas"));
    expect(mockIniciarSesion).toHaveBeenCalledWith("t-dueno", "r-nuevo", sesionDueno.usuario);
  });

  it("con 2FA pide el código y termina con /auth/2fa/verificar", async () => {
    vi.mocked(kioscoApi.salir).mockResolvedValue({ requiere2FA: true, challengeToken: "desafio" } as never);
    vi.mocked(authApi.verificar2FA)
      .mockRejectedValueOnce(errorHttp(401))
      .mockResolvedValueOnce(sesionDueno as never);
    const dialogo = await abrirSalida();
    enviarContrasena(dialogo, "buena");

    const campo = await within(dialogo).findByLabelText("Código de verificación");
    expect(mockIniciarSesion).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "000000" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Código incorrecto o expirado.");

    fireEvent.change(within(dialogo).getByLabelText("Código de verificación"), { target: { value: "123456" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard/citas"));
    expect(authApi.verificar2FA).toHaveBeenLastCalledWith("desafio", "123456");
    expect(mockIniciarSesion).toHaveBeenCalledWith("t-dueno", "r-nuevo", sesionDueno.usuario);
  });

  describe("límite de intentos del servidor", () => {
    it("el 429 bloquea la salida con la cuenta atrás que indica el servidor", async () => {
      vi.mocked(kioscoApi.salir).mockRejectedValue(demasiadosIntentos(300));
      const dialogo = await abrirSalida();
      enviarContrasena(dialogo, "mala");

      expect(await within(dialogo).findByText("5:00")).toBeInTheDocument();
      expect(within(dialogo).getByRole("alert")).toHaveTextContent("Demasiados intentos incorrectos");
      expect(within(dialogo).getByLabelText("Contraseña")).toBeDisabled();

      act(() => { vi.advanceTimersByTime(60_000); });
      expect(within(dialogo).getByText("4:00")).toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(4 * 60_000); });
      await vi.waitFor(() => expect(within(dialogo).getByLabelText("Contraseña")).toBeEnabled());
      expect(within(dialogo).queryByText(/Demasiados intentos/)).not.toBeInTheDocument();
    });

    it("la cuenta atrás sobrevive a recargar la página (sessionStorage)", async () => {
      vi.mocked(kioscoApi.salir).mockRejectedValue(demasiadosIntentos(120));
      const dialogo = await abrirSalida();
      enviarContrasena(dialogo, "mala");
      await within(dialogo).findByText(/Demasiados intentos/);
      cleanup();

      const nuevo = await abrirSalida();
      expect(within(nuevo).getByText(/Demasiados intentos/)).toBeInTheDocument();
      expect(within(nuevo).getByLabelText("Contraseña")).toBeDisabled();
      expect(kioscoApi.salir).toHaveBeenCalledTimes(1);
    });
  });
});

describe("KioskPage — carga y conexión (DC-28)", () => {
  it("mientras carga dice que está cargando, no 'No hay empleados activos'", async () => {
    vi.mocked(kioscoApi.agenda).mockReturnValue(new Promise(() => {}));
    renderKiosk();
    expect(await screen.findByText(/Cargando .* de hoy…/)).toBeInTheDocument();
    expect(screen.queryByText("No hay empleados activos")).toBeNull();
  });

  it("un fallo de red avisa 'Sin conexión · reintentando' en vez de parecer un día vacío", async () => {
    vi.mocked(kioscoApi.agenda).mockRejectedValue(new Error("red"));
    renderKiosk();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión · reintentando");
    expect(screen.queryByText("No hay empleados activos")).toBeNull();
  });

  it("vuelve a pedir la agenda tras un fallo y el aviso desaparece solo", async () => {
    vi.mocked(kioscoApi.agenda).mockRejectedValueOnce(new Error("red"));
    renderKiosk();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión · reintentando");

    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({ empleados: [ANA] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS); });

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un 403 (empleado sin ficha) muestra el motivo del servidor, no 'Sin conexión', y deja de sondear", async () => {
    vi.mocked(kioscoApi.agenda).mockRejectedValue(errorHttp(403, {
      mensaje: "Tu usuario no está vinculado a ningún empleado de este negocio.",
      codigoError: "EMPLEADO_NO_VINCULADO",
    }));
    renderKiosk();
    expect(await screen.findByRole("alert")).toHaveTextContent("no está vinculado a ningún empleado");
    expect(screen.queryByText(/Sin conexión/)).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(INTERVALO_SONDEO_MS * 2); });
    expect(kioscoApi.agenda).toHaveBeenCalledTimes(1);
  });

  it("sin nada cargado ofrece 'Reintentar' a mano", async () => {
    vi.mocked(kioscoApi.agenda).mockRejectedValueOnce(new Error("red"));
    renderKiosk();
    const boton = await screen.findByRole("button", { name: "Reintentar" });
    vi.mocked(kioscoApi.agenda).mockResolvedValue(agenda({ empleados: [ANA] }));
    fireEvent.click(boton);
    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
