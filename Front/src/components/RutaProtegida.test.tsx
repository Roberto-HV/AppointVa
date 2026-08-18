import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// ── hoisted values ───────────────────────────────────────────────
const mockHasHydrated = vi.hoisted(() => vi.fn(() => true));
const mockOnFinishHydration = vi.hoisted(() => vi.fn(() => () => {}));
const authState = vi.hoisted(() => ({
  token: null as string | null,
  usuario: null as { rol: string } | null,
}));

// ── module mocks ─────────────────────────────────────────────────
vi.mock("../store/authStore", () => {
  const useAuthStore = Object.assign(
    () => authState,
    {
      persist: {
        hasHydrated: mockHasHydrated,
        onFinishHydration: mockOnFinishHydration,
      },
    }
  );
  return { useAuthStore };
});

vi.mock("./ui/Skeleton", () => ({
  PageLoader: () => <div data-testid="page-loader" />,
}));

// ── lazy imports ─────────────────────────────────────────────────
import RutaProtegida from "./RutaProtegida";

// ── helpers ──────────────────────────────────────────────────────
interface RenderOptions {
  token?: string | null;
  usuario?: { rol: string } | null;
  roles?: string[];
  initialPath?: string;
}

function renderWithRoutes({
  token = null,
  usuario = null,
  roles,
  initialPath = "/restricted",
}: RenderOptions = {}) {
  authState.token = token;
  authState.usuario = usuario;

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard fallback</div>} />
        <Route path="/admin" element={<div>Admin area</div>} />
        <Route element={<RutaProtegida roles={roles} />}>
          <Route path="/restricted" element={<div>Protected content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  authState.token = null;
  authState.usuario = null;
  vi.clearAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────
describe("RutaProtegida — sin autenticar", () => {
  it("redirige a /login cuando no hay token", () => {
    renderWithRoutes({ token: null, usuario: null });
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });
});

describe("RutaProtegida — autenticado", () => {
  it("muestra el contenido protegido cuando hay token", () => {
    renderWithRoutes({
      token: "tok",
      usuario: { rol: "Propietario" },
    });
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});

describe("RutaProtegida — restricción por rol", () => {
  it("redirige cuando el rol no coincide con los roles permitidos", () => {
    renderWithRoutes({
      token: "tok",
      usuario: { rol: "Propietario" },
      roles: ["SuperAdmin"],
    });
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard fallback")).toBeInTheDocument();
  });

  it("muestra el contenido cuando el rol coincide con los roles permitidos", () => {
    renderWithRoutes({
      token: "tok",
      usuario: { rol: "Propietario" },
      roles: ["Propietario"],
    });
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
