import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BookingPage from "./BookingPage";
import type { NegocioPublico } from "../../types";

// ── Router ────────────────────────────────────────────────────────────────────
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ slug: "salon-test" }),
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams()],
  };
});

// ── API modules ───────────────────────────────────────────────────────────────
vi.mock("../../api/publico", () => ({
  publicoApi: {
    obtenerNegocio: vi.fn(),
    buscarClienteDatos: vi.fn(),
    crearCita: vi.fn(),
  },
}));

vi.mock("../../api/intake", () => ({
  intakePublicoApi: {
    getCampos: vi.fn().mockResolvedValue([]),
    guardarRespuestas: vi.fn(),
  },
}));

vi.mock("../../api/descuentos", () => ({
  descuentosPublicoApi: {
    validar: vi.fn(),
  },
}));

// ── Animation: pass children through without transitions ──────────────────────
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, custom: _c, variants: _v, initial: _i, animate: _a, exit: _e, ...rest }: any) =>
      <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
}));

// ── Booking sub-components ────────────────────────────────────────────────────
vi.mock("../../components/booking/PasoServicio", () => ({
  default: ({ servicios }: { servicios: { id: string; nombre: string }[] }) => (
    <div data-testid="paso-servicio">
      {servicios.map((s) => <span key={s.id}>{s.nombre}</span>)}
    </div>
  ),
}));

vi.mock("../../components/booking/PasoEmpleado", () => ({
  default: () => <div data-testid="paso-empleado" />,
  SIN_PREFERENCIA_ID: "sin-preferencia",
}));

vi.mock("../../components/booking/PasoFechaHora", () => ({
  default: () => <div data-testid="paso-fecha-hora" />,
}));

vi.mock("../../components/booking/PasoDatosCliente", () => ({
  default: () => <div data-testid="paso-datos-cliente" />,
}));

vi.mock("../../components/booking/IndicadorPasos", () => ({
  default: ({ pasoActual }: { pasoActual: number; pasos: string[] }) => (
    <div data-testid="indicador-pasos" data-paso={String(pasoActual)} />
  ),
}));

// ── Shared UI ─────────────────────────────────────────────────────────────────
vi.mock("../../components/PublicFooter", () => ({
  default: () => <div data-testid="public-footer" />,
}));

vi.mock("../../components/icons/WhatsAppIcon", () => ({
  default: () => <svg data-testid="whatsapp-icon" />,
}));

vi.mock("../../components/icons/SocialLinks", () => ({
  default: () => <div data-testid="social-links" />,
}));

vi.mock("../../lib/colorUtils", () => ({
  hexToChannels: () => "99 102 241",
  DEFAULT_COLOR: "#334155",
}));

// ── Test data ─────────────────────────────────────────────────────────────────
import { publicoApi } from "../../api/publico";

const mockNegocio: NegocioPublico = {
  id: "neg-1",
  slug: "salon-test",
  nombre: "Salón Test",
  descripcion: "Salón de belleza de prueba",
  colorPrimario: "#6366f1",
  colorSecundario: "#4f46e5",
  horasCancelacion: 0,
  autoConfirmar: true,
  requiereAnticipo: false,
  montoAnticipo: 0,
  servicios: [
    {
      id: "srv-1",
      nombre: "Corte de cabello",
      duracionMinutos: 30,
      bufferMinutos: 0,
      precio: 150,
      orden: 1,
    },
  ],
  empleados: [
    {
      id: "emp-1",
      nombre: "Ana García",
      servicioIds: ["srv-1"],
      promedioResenas: 0,
      totalResenas: 0,
    },
  ],
  galeria: [],
  promedioResenas: 0,
  totalResenas: 0,
  resenas: [],
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <BookingPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("BookingPage", () => {
  it("shows loading skeleton while fetching business data", () => {
    vi.mocked(publicoApi.obtenerNegocio).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows error state when business is not found (404)", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockRejectedValue({
      response: { status: 404 },
    });
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByText(/Este negocio no está disponible/i)
      ).toBeInTheDocument()
    );
  });

  it("shows business name in header after data loads", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Salón Test")).toBeInTheDocument()
    );
  });

  it("renders step 1 (service selection) by default", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("paso-servicio")).toBeInTheDocument()
    );
  });

  it("shows step indicator at paso 1 after data loads", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("indicador-pasos")).toHaveAttribute(
        "data-paso",
        "1"
      )
    );
  });
});
