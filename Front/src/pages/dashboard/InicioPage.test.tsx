import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InicioPage from "./InicioPage";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockToast = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("../../store/toastStore", () => ({
  useToastStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ toasts: [], toast: mockToast, quitar: vi.fn() })
  ),
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../api/dashboard", () => ({
  dashboardApi: {
    obtenerResumen: vi.fn(),
    obtenerTendencia: vi.fn(),
  },
}));

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn(),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn(),
    obtenerHorarios: vi.fn(),
    obtenerGaleria: vi.fn(),
  },
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerTodos: vi.fn(),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn(),
  },
}));

vi.mock("../../api/clientes", () => ({
  clientesApi: {
    obtenerCitas: vi.fn(),
  },
}));

vi.mock("../../components/ui/NotificacionBanner", () => ({
  NotificacionBanner: () => null,
}));

vi.mock("../../components/ui/AnimatedCounter", () => ({
  default: ({ to }: { to: number }) => <span>{to}</span>,
}));

vi.mock("../../components/ui/EstadoBadge", () => ({
  default: ({ estado }: { estado: string }) => (
    <span data-testid="estado-badge">{estado}</span>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      style,
    }: {
      children?: React.ReactNode;
      className?: string;
      style?: React.CSSProperties;
    }) => (
      <div className={className} style={style}>
        {children}
      </div>
    ),
  },
}));

vi.mock("recharts", () => ({
  AreaChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Legend: () => null,
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { useAuthStore } from "../../store/authStore";
import { dashboardApi } from "../../api/dashboard";
import { citasApi } from "../../api/citas";
import { negociosApi } from "../../api/negocios";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";

// ── Test data ─────────────────────────────────────────────────────────────────
const propietarioUser = {
  id: "u1",
  email: "owner@test.com",
  nombreCompleto: "Roberto López",
  rol: "Propietario",
  negocioId: "neg-1",
};

const empleadoUser = {
  id: "u2",
  email: "emp@test.com",
  nombreCompleto: "Ana García",
  rol: "Empleado",
  negocioId: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNegocio: any = {
  id: "neg-1",
  nombre: "Salón Test",
  slug: "salon-test",
  descripcion: null,
  telefono: "5511223344",
  direccion: null,
  colorPrimario: "#000000",
  colorSecundario: null,
  logoUrl: null,
  portadaUrl: null,
  moduloPagosHabilitado: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockResumen: any = {
  citasHoy: 3,
  citasSemana: 12,
  citasMes: 45,
  ingresosHoy: 600,
  ingresosSemana: 2400,
  ingresosMes: 9000,
  proximasCitas: [],
  topServicios: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emptyPage: any = { datos: [], total: 0, pagina: 1, tamano: 100 };

// ── Render helper ─────────────────────────────────────────────────────────────
function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <InicioPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  // Default role: Propietario
  vi.mocked(useAuthStore).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ usuario: propietarioUser })
  );

  // API defaults
  vi.mocked(dashboardApi.obtenerResumen).mockResolvedValue(mockResumen);
  vi.mocked(dashboardApi.obtenerTendencia).mockResolvedValue([]);
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue(emptyPage);
  vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue(mockNegocio);
  vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue([]);
  vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
  vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
  vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 1. Owner view renders without crash ───────────────────────────────────────
describe("InicioPage — vista propietario", () => {
  it("renders without crash and shows KPI card labels", async () => {
    renderConQuery();

    // KPI labels appear once dashboardApi.obtenerResumen resolves
    const hoyLabels = await screen.findAllByText("Hoy");
    expect(hoyLabels.length).toBeGreaterThanOrEqual(1);

    const semanaLabels = screen.getAllByText("Semana");
    expect(semanaLabels.length).toBeGreaterThanOrEqual(1);

    const mesLabels = screen.getAllByText("Mes");
    expect(mesLabels.length).toBeGreaterThanOrEqual(1);
  });
});

// ── 2. Wizard visible when localStorage key is absent ────────────────────────
describe("InicioPage — wizard de onboarding", () => {
  it("shows wizard when the onboarding localStorage key is absent", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

    renderConQuery();

    expect(await screen.findByText("Configura tu negocio")).toBeInTheDocument();
  });

  // ── 3. Wizard closes on button click ────────────────────────────────────────
  it("hides wizard and calls localStorage.setItem when close button is clicked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    renderConQuery();

    const heading = await screen.findByText("Configura tu negocio");
    // The close <button> is the only button element inside the wizard container
    const wizardDiv = heading.closest(".rounded-xl") as HTMLElement;
    const closeBtn = within(wizardDiv).getByRole("button");

    fireEvent.click(closeBtn);

    await waitFor(() =>
      expect(screen.queryByText("Configura tu negocio")).not.toBeInTheDocument()
    );
    expect(setItemSpy).toHaveBeenCalledWith("onboarding-ok-neg-1", "1");
  });

  // ── 4. "Ver guía de inicio" reopens wizard ───────────────────────────────────
  it("reopens wizard when 'Ver guía de inicio' button is clicked", async () => {
    // Wizard starts closed: the onboarding key is already stored
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (key === "onboarding-ok-neg-1") return "1";
      return null;
    });

    renderConQuery();

    // Button to reopen appears in the header regardless of data loading state
    const btnGuia = await screen.findByRole("button", { name: /ver guía de inicio/i });
    fireEvent.click(btnGuia);

    // Wizard re-appears once negocio + resumen queries resolve
    expect(await screen.findByText("Configura tu negocio")).toBeInTheDocument();
  });
});

// ── 5. Quick action links render ──────────────────────────────────────────────
describe("InicioPage — accesos rápidos", () => {
  it("renders navigation links for Citas, Servicios, Clientes, and Reportes", async () => {
    renderConQuery();

    // Quick action links are rendered immediately with MemoryRouter
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /citas/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /servicios/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /clientes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reportes/i })).toBeInTheDocument();
  });
});

// ── 6. Employee view renders ──────────────────────────────────────────────────
describe("InicioPage — vista empleado", () => {
  it("renders employee name as heading and shows stat section labels", async () => {
    vi.mocked(useAuthStore).mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ usuario: empleadoUser })
    );

    renderConQuery();

    // First name extracted from "Ana García"
    expect(
      await screen.findByRole("heading", { level: 1, name: "Ana" })
    ).toBeInTheDocument();

    // Stat labels render before query data arrives
    expect(screen.getByText("Citas hoy")).toBeInTheDocument();
    expect(screen.getByText("Completadas")).toBeInTheDocument();
  });
});

// ── 7. Period toggle ──────────────────────────────────────────────────────────
describe("InicioPage — toggle de período", () => {
  it("calls obtenerTendencia with 7 when the 7d button is clicked", async () => {
    renderConQuery();

    // Period buttons render inside the data-dependent chart section
    const btn7d = await screen.findByRole("button", { name: "7d" });
    fireEvent.click(btn7d);

    await waitFor(() =>
      expect(vi.mocked(dashboardApi.obtenerTendencia)).toHaveBeenCalledWith(7)
    );
  });

  it("14d button has active styling on mount (default period)", async () => {
    renderConQuery();

    const btn14d = await screen.findByRole("button", { name: "14d" });
    // Active period button gets bg-white class (light mode active indicator)
    expect(btn14d.className).toContain("bg-white");

    // Inactive buttons should not have bg-white
    const btn7d = screen.getByRole("button", { name: "7d" });
    expect(btn7d.className).not.toContain("bg-white");
  });
});
