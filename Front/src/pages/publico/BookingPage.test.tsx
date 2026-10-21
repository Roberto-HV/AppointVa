import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import BookingPage from "./BookingPage";
import type { NegocioPublico } from "../../types";

// ── Router ────────────────────────────────────────────────────────────────────
// El paso vive en la URL, así que el wizard corre sobre un MemoryRouter real;
// solo el slug se fija.
vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ slug: "salon-test" }),
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
      <h2 tabIndex={-1}>¿Con quién?</h2>
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
  default: ({ formId, onEnviar, onClienteReconocidoChange, valoresIniciales, onValoresChange }: {
    formId: string;
    onEnviar: (d: { nombreCliente: string; telefonoCliente: string }) => void;
    onClienteReconocidoChange?: (reconocido: boolean) => void;
    valoresIniciales?: { nombreCliente?: string };
    onValoresChange?: (v: { nombreCliente?: string }) => void;
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
      <input
        aria-label="Nombre"
        defaultValue={valoresIniciales?.nombreCliente ?? ""}
        onChange={(e) => onValoresChange?.({ nombreCliente: e.target.value })}
      />
      {/* Sustituyen al «Sí, soy yo» / «No, no soy yo» del paso real. */}
      <button type="button" onClick={() => onClienteReconocidoChange?.(true)}>stub-reconocer</button>
      <button type="button" onClick={() => onClienteReconocidoChange?.(false)}>stub-rechazar</button>
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

vi.mock("../../lib/colorUtils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/colorUtils")>()),
  hexToChannels: () => "99 102 241",
  degradeGradient: () => "linear-gradient(#000, #111)",
}));

// ── Test data ─────────────────────────────────────────────────────────────────
import { publicoApi } from "../../api/publico";
import { intakePublicoApi } from "../../api/intake";
import { fondoPortada } from "../../lib/portadaPresets";

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

/** Expone la URL actual del MemoryRouter y un «atrás» de navegador. */
function UbicacionActual() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <span data-testid="ubicacion">{`${pathname}${search}`}</span>
      <button type="button" onClick={() => navigate(-1)}>atras-navegador</button>
    </>
  );
}

function renderConQuery(rutaInicial = "/b/salon-test") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[rutaInicial]}>
      <QueryClientProvider client={qc}>
        <BookingPage />
        <UbicacionActual />
      </QueryClientProvider>
    </MemoryRouter>
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

  it("envía confirmarClienteExistente sin abrir la hoja si el visitante ya se identificó", async () => {
    const form = await avanzarHastaPaso4();
    fireEvent.click(screen.getByRole("button", { name: "stub-reconocer" }));
    vi.mocked(publicoApi.crearCita).mockResolvedValueOnce({ codigoConfirmacion: "ABC123" } as never);

    fireEvent.submit(form);

    await waitFor(() => expect(publicoApi.crearCita).toHaveBeenCalledTimes(1));
    expect(vi.mocked(publicoApi.crearCita).mock.calls[0][0].confirmarClienteExistente).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deja que la hoja aparezca cuando el visitante rechazó la sugerencia", async () => {
    const form = await avanzarHastaPaso4();
    fireEvent.click(screen.getByRole("button", { name: "stub-reconocer" }));
    fireEvent.click(screen.getByRole("button", { name: "stub-rechazar" }));
    rechazarPorNombreDistinto();

    fireEvent.submit(form);

    expect(vi.mocked(publicoApi.crearCita).mock.calls[0][0].confirmarClienteExistente).toBeUndefined();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
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

// ── Portada ───────────────────────────────────────────────────────────────────
describe("BookingPage — portada", () => {
  // La foto de portada es el único <img alt=""> del encabezado; el logo lleva el
  // nombre del negocio como texto alternativo.
  const fotoDePortada = () => document.querySelector<HTMLImageElement>('img[alt=""]');

  // jsdom reescribe el shorthand `background` al serializarlo, así que el valor
  // esperado tiene que pasar por la misma normalización para poder compararse.
  function fondoNormalizado(clave: string | null): string {
    const el = document.createElement("div");
    el.style.background = fondoPortada(clave, mockNegocio.colorPrimario!).background;
    return el.style.background;
  }

  it("dibuja el fondo generado cuando el negocio eligió uno y no hay foto", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      portadaPreset: "deg-aurora",
    });
    renderConQuery();

    const portada = await screen.findByTestId("portada-negocio");
    expect(portada.style.background).toBe(fondoNormalizado("deg-aurora"));
    expect(fotoDePortada()).toBeNull();
  });

  it("dibuja la foto cuando el negocio subió una y no eligió fondo", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      portadaUrl: "https://cdn.test/portada.jpg",
    });
    renderConQuery();

    await screen.findByTestId("portada-negocio");
    const foto = fotoDePortada();
    expect(foto).not.toBeNull();
    expect(foto!.src).toBe("https://cdn.test/portada.jpg");
  });

  it("el fondo elegido gana sobre la foto subida", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      portadaUrl: "https://cdn.test/portada.jpg",
      portadaPreset: "geo-arcos",
    });
    renderConQuery();

    const portada = await screen.findByTestId("portada-negocio");
    expect(portada.style.background).toBe(fondoNormalizado("geo-arcos"));
    expect(fotoDePortada()).toBeNull();
  });

  it("carga la foto con prioridad: es el elemento LCP de la página", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      portadaUrl: "https://cdn.test/portada.jpg",
    });
    renderConQuery();

    await screen.findByTestId("portada-negocio");
    const foto = fotoDePortada()!;
    expect(foto.getAttribute("loading")).toBe("eager");
    expect(foto.getAttribute("fetchpriority")).toBe("high");
    // Sin atenuar: el contraste del texto lo sostiene el velo, no la opacidad.
    expect(foto.style.opacity).toBe("");
  });

  it("cae al degradado de marca con una clave de fondo que ya no existe", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      portadaPreset: "preset-retirado",
    });
    renderConQuery();

    const portada = await screen.findByTestId("portada-negocio");
    expect(portada.style.background).toBe(fondoNormalizado(null));
  });
});

// ── BF-01/02/03: paso en la URL, estado conservado, foco ──────────────────────
const ubicacion = () => screen.getByTestId("ubicacion").textContent;
const continuar = () => fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
const atras = () => fireEvent.click(screen.getByRole("button", { name: "Atrás" }));

describe("BookingPage — navegación entre pasos", () => {
  it("refleja cada paso en ?paso= para que el historial lo recorra", async () => {
    await avanzarHastaPaso4();
    expect(ubicacion()).toBe("/b/salon-test?paso=4");
  });

  it("el atrás del navegador vuelve al paso anterior sin salir del wizard", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Corte de cabello" }));
    continuar();
    fireEvent.click(await screen.findByRole("button", { name: "Ana García" }));
    continuar();
    await screen.findByTestId("paso-fecha-hora");

    fireEvent.click(screen.getByRole("button", { name: "atras-navegador" }));

    expect(await screen.findByTestId("paso-empleado")).toBeInTheDocument();
    expect(ubicacion()).toBe("/b/salon-test?paso=2");
    // La elección sigue en pie: se puede continuar sin volver a elegir.
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it("el Atrás de pantalla reutiliza la entrada del historial en lugar de apilar otra", async () => {
    await avanzarHastaPaso4();
    atras();
    await screen.findByTestId("paso-fecha-hora");
    expect(ubicacion()).toBe("/b/salon-test?paso=3");

    fireEvent.click(screen.getByRole("button", { name: "atras-navegador" }));
    expect(await screen.findByTestId("paso-empleado")).toBeInTheDocument();
  });

  it("volver atrás conserva servicio, profesional, horario y datos del cliente", async () => {
    await avanzarHastaPaso4();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Ruiz" } });

    atras(); // → 3
    await screen.findByTestId("paso-fecha-hora");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled(); // horario conservado
    atras(); // → 2
    await screen.findByTestId("paso-empleado");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    atras(); // → 1
    await screen.findByTestId("paso-servicio");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();

    continuar();
    await screen.findByTestId("paso-empleado");
    continuar();
    await screen.findByTestId("paso-fecha-hora");
    continuar();
    await screen.findByTestId("paso-datos-cliente");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana Ruiz");
  });

  it("cambiar de servicio invalida el profesional elegido", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      servicios: [
        ...mockNegocio.servicios,
        { id: "srv-2", nombre: "Tinte", duracionMinutos: 60, bufferMinutos: 0, precio: 400, orden: 2 },
      ],
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Corte de cabello" }));
    continuar();
    fireEvent.click(await screen.findByRole("button", { name: "Ana García" }));
    atras();

    fireEvent.click(await screen.findByRole("button", { name: "Tinte" }));
    continuar();

    await screen.findByTestId("paso-empleado");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("conserva las respuestas de las preguntas al volver desde el paso 4", async () => {
    vi.mocked(intakePublicoApi.getCampos).mockResolvedValue([
      { id: "c1", etiqueta: "¿Alergias?", tipo: "Texto", requerido: true, orden: 1 },
    ]);
    try {
      vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
      renderConQuery();
      fireEvent.click(await screen.findByRole("button", { name: "Corte de cabello" }));
      continuar();
      fireEvent.click(await screen.findByRole("button", { name: "Ana García" }));
      continuar();
      fireEvent.click(await screen.findByRole("button", { name: "10:00" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled());
      continuar();

      const campo = await screen.findByLabelText(/¿Alergias\?/);
      expect(ubicacion()).toBe("/b/salon-test?paso=preguntas");
      expect(campo).toHaveAttribute("aria-required", "true");
      fireEvent.change(campo, { target: { value: "Ninguna" } });
      continuar();
      await screen.findByTestId("paso-datos-cliente");

      atras();
      expect(await screen.findByLabelText(/¿Alergias\?/)).toHaveValue("Ninguna");
    } finally {
      vi.mocked(intakePublicoApi.getCampos).mockResolvedValue([]);
    }
  });

  it("marca una pregunta obligatoria vacía como inválida y la liga a su mensaje", async () => {
    vi.mocked(intakePublicoApi.getCampos).mockResolvedValue([
      { id: "c1", etiqueta: "¿Alergias?", tipo: "Texto", requerido: true, orden: 1 },
    ]);
    try {
      vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
      renderConQuery();
      fireEvent.click(await screen.findByRole("button", { name: "Corte de cabello" }));
      continuar();
      fireEvent.click(await screen.findByRole("button", { name: "Ana García" }));
      continuar();
      fireEvent.click(await screen.findByRole("button", { name: "10:00" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled());
      continuar();
      const campo = await screen.findByLabelText(/¿Alergias\?/);

      continuar(); // sin responder

      expect(campo).toHaveAttribute("aria-invalid", "true");
      expect(campo).toHaveAccessibleDescription("Este campo es obligatorio");
    } finally {
      vi.mocked(intakePublicoApi.getCampos).mockResolvedValue([]);
    }
  });

  it("un enlace directo a un paso posterior sin datos cae en el primer paso incompleto", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery("/b/salon-test?paso=4");

    expect(await screen.findByTestId("paso-servicio")).toBeInTheDocument();
    await waitFor(() => expect(ubicacion()).toBe("/b/salon-test"));
  });

  it("al cambiar de paso mueve el foco al encabezado y anuncia el paso", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Corte de cabello" }));
    continuar();

    const encabezado = await screen.findByRole("heading", { name: "¿Con quién?" });
    expect(document.activeElement).toBe(encabezado);
    expect(screen.getByRole("status")).toHaveTextContent("Paso 2 de 4: Empleado");
  });

  it("no roba el foco en la carga inicial", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio);
    renderConQuery();
    await screen.findByTestId("paso-servicio");
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("BookingPage — código de descuento", () => {
  it("el campo del código tiene nombre accesible", async () => {
    await avanzarHastaPaso4();
    fireEvent.click(screen.getByRole("button", { name: /tienes un código de descuento/i }));
    expect(screen.getByLabelText("Código de descuento")).toHaveAttribute("placeholder", "PROMO20");
  });
});
