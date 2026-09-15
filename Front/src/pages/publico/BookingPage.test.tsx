import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
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
    div: ({ children, custom: _c, variants: _v, initial: _i, animate: _a, exit: _e, transition: _t, ...rest }: any) =>
      <div {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
  useReducedMotion: () => false,
}));

// ── Booking sub-components ────────────────────────────────────────────────────
// Los stubs exponen un disparador de selección para poder recorrer el wizard.
type Opcion = { id: string; nombre: string };

vi.mock("../../components/booking/PasoServicio", () => ({
  default: ({ servicios, onSeleccionar }: { servicios: Opcion[]; onSeleccionar: (s: Opcion) => void }) => (
    <div data-testid="paso-servicio">
      {servicios.map((s) => (
        <button key={s.id} type="button" onClick={() => onSeleccionar(s)}>{s.nombre}</button>
      ))}
    </div>
  ),
}));

vi.mock("../../components/booking/PasoEmpleado", () => ({
  default: ({ empleados, onSeleccionar }: { empleados: Opcion[]; onSeleccionar: (e: Opcion) => void }) => (
    <div data-testid="paso-empleado">
      {empleados.map((e) => (
        <button key={e.id} type="button" onClick={() => onSeleccionar(e)}>{e.nombre}</button>
      ))}
    </div>
  ),
  SIN_PREFERENCIA_ID: "sin-preferencia",
}));

vi.mock("../../components/booking/PasoFechaHora", () => ({
  default: ({ onSeleccionar }: { onSeleccionar: (s: { inicio: string; fin: string; horaTexto: string }) => void }) => (
    <div data-testid="paso-fecha-hora">
      <button
        type="button"
        onClick={() => onSeleccionar({ inicio: "2026-07-22T10:00:00", fin: "2026-07-22T10:30:00", horaTexto: "10:00" })}
      >
        10:00
      </button>
    </div>
  ),
}));

vi.mock("../../components/booking/PasoDatosCliente", () => ({
  default: ({ formId, onEnviar }: {
    formId: string;
    onEnviar: (d: { nombreCliente: string; telefonoCliente: string }) => void;
  }) => (
    <form
      id={formId}
      data-testid="paso-datos-cliente"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar({ nombreCliente: "Ana Ruiz", telefonoCliente: "5512345678" });
      }}
    >
      <input name="telefonoCliente" aria-label="Teléfono" defaultValue="5512345678" />
    </form>
  ),
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

vi.mock("react-icons/si", () => ({
  SiWhatsapp: () => <svg data-testid="whatsapp-icon" />,
  SiApple: () => <svg data-testid="apple-icon" />,
  SiGooglecalendar: () => <svg data-testid="google-calendar-icon" />,
  SiInstagram: () => <svg data-testid="instagram-icon" />,
  SiFacebook: () => <svg data-testid="facebook-icon" />,
  SiTiktok: () => <svg data-testid="tiktok-icon" />,
}));

vi.mock("../../components/icons/SocialLinks", () => ({
  default: () => <div data-testid="social-links" />,
}));

vi.mock("../../lib/colorUtils", () => ({
  hexToChannels: () => "99 102 241",
  DEFAULT_COLOR: "#334155",
  degradeGradient: () => "linear-gradient(#000, #111)",
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
  diasAnticipacionMinima: 0,
  autoConfirmar: true,
  requiereAnticipo: false,
  montoAnticipo: 0,
  sector: 'belleza',
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

// ── Barra de acción ───────────────────────────────────────────────────────────
async function avanzarHastaPaso4() {
  vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
  renderConQuery();

  fireEvent.click(await screen.findByRole("button", { name: "Corte de cabello" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  fireEvent.click(await screen.findByRole("button", { name: "Ana García" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  fireEvent.click(await screen.findByRole("button", { name: "10:00" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  return screen.findByTestId("paso-datos-cliente");
}

describe("BookingPage — barra de acción", () => {
  it("renders a single action bar outside the animated step wrapper", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    const { container } = renderConQuery();

    const continuar = await screen.findByRole("button", { name: "Continuar" });
    expect(continuar).toBeDisabled();
    // La barra no puede colgar del contenedor animado: un fixed dentro de un
    // transform se anclaría al transform en lugar del viewport.
    expect(container.querySelector('[data-testid="paso-servicio"]')?.contains(continuar)).toBe(false);
  });

  it("wires the last step's primary button to the form inside PasoDatosCliente", async () => {
    await avanzarHastaPaso4();
    expect(screen.getByRole("button", { name: "Confirmar cita" })).toHaveAttribute(
      "form",
      "form-datos-cliente"
    );
  });
});

// ── Hoja de conflicto de cliente ──────────────────────────────────────────────
function rechazarPorNombreDistinto() {
  vi.mocked(publicoApi.crearCita).mockRejectedValueOnce({
    response: {
      status: 409,
      data: {
        codigo: "CLIENTE_NOMBRE_DISTINTO",
        mensaje: "Ese teléfono ya está registrado a nombre de otra persona.",
        nombreExistente: "Elena López",
      },
    },
  });
}

describe("BookingPage — hoja «¿eres tú?»", () => {
  it("abre la hoja con el nombre registrado cuando la API responde CLIENTE_NOMBRE_DISTINTO", async () => {
    const form = await avanzarHastaPaso4();
    rechazarPorNombreDistinto();
    fireEvent.submit(form);

    const hoja = await screen.findByRole("dialog");
    expect(hoja).toHaveAttribute("aria-modal", "true");
    expect(within(hoja).getByText("Elena López")).toBeInTheDocument();
    // No debe caer en la rama de horario ocupado
    expect(screen.queryByText(/ya no está disponible/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("indicador-pasos")).toHaveAttribute("data-paso", "4");
  });

  it("reenvía con confirmarClienteExistente al confirmar que sí es la persona", async () => {
    const form = await avanzarHastaPaso4();
    rechazarPorNombreDistinto();
    fireEvent.submit(form);

    fireEvent.click(await screen.findByRole("button", { name: "Sí, soy yo" }));

    await waitFor(() => expect(publicoApi.crearCita).toHaveBeenCalledTimes(2));
    expect(vi.mocked(publicoApi.crearCita).mock.calls[0][0].confirmarClienteExistente).toBeUndefined();
    expect(vi.mocked(publicoApi.crearCita).mock.calls[1][0]).toMatchObject({
      nombreCliente: "Ana Ruiz",
      telefonoCliente: "5512345678",
      servicioId: "srv-1",
      confirmarClienteExistente: true,
    });
  });

  it("cierra la hoja y devuelve el foco al teléfono al elegir corregirlo", async () => {
    const form = await avanzarHastaPaso4();
    rechazarPorNombreDistinto();
    fireEvent.submit(form);

    fireEvent.click(await screen.findByRole("button", { name: "Corregir mi teléfono" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByLabelText("Teléfono"));
    expect(publicoApi.crearCita).toHaveBeenCalledTimes(1);
  });

  it("cierra la hoja con Escape sin reenviar la cita", async () => {
    const form = await avanzarHastaPaso4();
    rechazarPorNombreDistinto();
    fireEvent.submit(form);
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(publicoApi.crearCita).toHaveBeenCalledTimes(1);
  });

  it("sigue mandando al paso 3 cuando el 409 es por horario ocupado", async () => {
    const form = await avanzarHastaPaso4();
    vi.mocked(publicoApi.crearCita).mockRejectedValueOnce({
      response: { status: 409, data: { codigo: "HORARIO_NO_DISPONIBLE", mensaje: "Horario no disponible" } },
    });
    fireEvent.submit(form);

    expect(await screen.findByText(/ya no está disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
