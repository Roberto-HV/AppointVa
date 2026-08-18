import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── hoisted values ──────────────────────────────────────────────
const mockNavigate = vi.hoisted(() => vi.fn());
const mockIniciarSesion = vi.hoisted(() => vi.fn());

// ── module mocks ────────────────────────────────────────────────
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => mockNavigate };
});

vi.mock("../../api/auth", () => ({
  authApi: {
    login: vi.fn(),
    verificar2FA: vi.fn(),
  },
}));

vi.mock("../../store/authStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (selector: (s: any) => unknown) =>
    selector({ iniciarSesion: mockIniciarSesion }),
}));

vi.mock("../../api/axios", () => ({
  api: { post: vi.fn(), get: vi.fn() },
}));

// ── lazy imports (after mocks) ──────────────────────────────────
import LoginPage from "./LoginPage";
import { authApi } from "../../api/auth";

// ── helpers ─────────────────────────────────────────────────────
function renderLoginPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <LoginPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const mockUser = {
  id: "u1",
  email: "test@test.com",
  nombreCompleto: "Test User",
  rol: "Propietario",
  negocioId: "n1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────
describe("LoginPage — renderizado", () => {
  it("muestra email, contraseña y botón de inicio de sesión", () => {
    renderLoginPage();
    expect(screen.getByPlaceholderText("correo@ejemplo.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });
});

describe("LoginPage — validación", () => {
  it("no llama a authApi.login al enviar con campos vacíos", async () => {
    const user = userEvent.setup();
    renderLoginPage();
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => {
      expect(vi.mocked(authApi.login)).not.toHaveBeenCalled();
    });
  });
});

describe("LoginPage — login exitoso", () => {
  it("llama a authApi.login con las credenciales correctas", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authApi.login).mockResolvedValue({
      token: "tok",
      refreshToken: "ref",
      usuario: mockUser,
    } as any);

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText("correo@ejemplo.com"), "test@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(vi.mocked(authApi.login)).toHaveBeenCalledWith("test@test.com", "password123");
    });
    expect(mockIniciarSesion).toHaveBeenCalledWith("tok", "ref", mockUser);
  });
});

describe("LoginPage — credenciales incorrectas", () => {
  it("muestra mensaje de error cuando el login falla", async () => {
    vi.mocked(authApi.login).mockRejectedValue({
      response: {
        status: 401,
        data: { mensaje: "Credenciales inválidas." },
      },
    });

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText("correo@ejemplo.com"), "wrong@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "badpass");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await screen.findByText("Credenciales inválidas.");
  });
});

describe("LoginPage — email no verificado", () => {
  it("muestra opción de reenviar verificación cuando el correo no está verificado", async () => {
    vi.mocked(authApi.login).mockRejectedValue({
      response: {
        status: 403,
        data: { codigoError: "EMAIL_NO_VERIFICADO" },
      },
    });

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText("correo@ejemplo.com"), "unverified@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "pass123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await screen.findByText("Reenviar correo de verificación");
  });
});

describe("LoginPage — desafío 2FA", () => {
  it("muestra input de código cuando el login requiere 2FA", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(authApi.login).mockResolvedValue({
      requiere2FA: true,
      challengeToken: "challenge-abc",
    } as any);

    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByPlaceholderText("correo@ejemplo.com"), "user@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "pass123");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await screen.findByPlaceholderText("000000");
  });
});
