import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CalendarioCitas from "./CalendarioCitas";
import { formatHoraEje } from "../../utils/formatters";

vi.mock("../../api/citas", () => ({
  citasApi: { obtenerTodas: vi.fn() },
}));
vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerHorarios: vi.fn(), obtenerDiasBloqueados: vi.fn() },
}));
vi.mock("../ui/DateTimePicker", () => ({
  DatePicker: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) => (
    <input aria-label={ariaLabel} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { citasApi } from "../../api/citas";
import { negociosApi } from "../../api/negocios";
import type { CitaDto } from "../../types";

// Lunes a sábado de 9:00 a 20:00; domingo cerrado.
const HORARIOS = Array.from({ length: 7 }, (_, dia) => ({
  diaSemana: dia,
  activo: dia !== 0,
  intervalos: dia === 0 ? [] : [{ horaInicio: "09:00", horaFin: "20:00" }],
}));

const matchMediaOriginal = window.matchMedia;

function simularMovil(movil: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: movil && q.includes("max-width"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarioCitas empleadoId="" onCitaClick={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 15 });
  vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue(HORARIOS);
  vi.mocked(negociosApi.obtenerDiasBloqueados).mockResolvedValue([]);
});
afterEach(() => {
  window.matchMedia = matchMediaOriginal;
  vi.useRealTimers();
});

// ── Lote 4: agenda operable ───────────────────────────────────────────────────

/** Lunes 7 de enero de 2030, 12:10 (hora local). */
function fijarAhora() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2030, 0, 7, 12, 10));
}

const citaEn = (id: string, d: Date, dur: number, over: Partial<CitaDto> = {}): CitaDto => ({
  id, codigoConfirmacion: id, clienteId: "c", empleadoId: "e1", servicioId: "s",
  nombreCliente: `Cliente ${id}`, telefonoCliente: "55", nombreEmpleado: "Ana", nombreServicio: "Corte",
  duracionMinutos: dur, precio: 100, pagada: false, inicioEn: d.toISOString(),
  finEn: new Date(d.getTime() + dur * 60_000).toISOString(), estado: 2, estadoTexto: "Confirmada", ...over,
});

function renderizarConHueco(props: Partial<React.ComponentProps<typeof CalendarioCitas>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onHuecoClick = vi.fn();
  const onCitaClick = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <CalendarioCitas empleadoId="" onCitaClick={onCitaClick} onHuecoClick={onHuecoClick} {...props} />
    </QueryClientProvider>,
  );
  return { onHuecoClick, onCitaClick };
}

// 64px por hora y la rejilla empieza a las 9 (apertura). jsdom mide la columna
// en y = 0, así que `clientY` es la distancia desde las 9:00.
const yDe = (h: number, m = 0) => (h - 9 + m / 60) * 64 + 1;

describe("CalendarioCitas — clic en un hueco abre Nueva cita (I1)", () => {
  it("en Semana, un hueco libre entrega fecha y hora (al cuarto de hora)", async () => {
    fijarAhora();
    simularMovil(false);
    const { onHuecoClick } = renderizarConHueco();
    await screen.findByText("Cerrado"); // horario cargado: el domingo sale cerrado
    fireEvent.click(screen.getByTestId("columna-2030-01-08"), { clientY: yDe(16, 20) });
    expect(onHuecoClick).toHaveBeenCalledWith({ inicio: new Date(2030, 0, 8, 16, 15), empleadoId: undefined });
  });

  it("con el filtro de empleado, el hueco lo lleva precargado", async () => {
    fijarAhora();
    simularMovil(false);
    const { onHuecoClick } = renderizarConHueco({ empleadoId: "emp-7" });
    await screen.findByText("Cerrado");
    fireEvent.click(screen.getByTestId("columna-2030-01-09"), { clientY: yDe(10) });
    expect(onHuecoClick).toHaveBeenCalledWith({ inicio: new Date(2030, 0, 9, 10, 0), empleadoId: "emp-7" });
  });

  it("un hueco pasado o de un día cerrado no abre nada", async () => {
    fijarAhora();
    simularMovil(false);
    const { onHuecoClick } = renderizarConHueco();
    await screen.findByText("Cerrado");
    fireEvent.click(screen.getByTestId("columna-2030-01-07"), { clientY: yDe(10) }); // hoy a las 10, ya pasó
    fireEvent.click(screen.getByTestId("columna-2030-01-13"), { clientY: yDe(11) }); // domingo cerrado
    expect(onHuecoClick).not.toHaveBeenCalled();
  });

  it("al pasar el puntero dice por qué un hueco no se puede usar", async () => {
    fijarAhora();
    simularMovil(false);
    renderizarConHueco();
    await screen.findByText("Cerrado");
    fireEvent.mouseMove(screen.getByTestId("columna-2030-01-07"), { clientY: yDe(10) });
    expect(screen.getByText("Ya pasó")).toBeInTheDocument();
    fireEvent.mouseMove(screen.getByTestId("columna-2030-01-08"), { clientY: yDe(16) });
    expect(screen.getByText(/^\+ 4:00/)).toBeInTheDocument();
  });

  it("en vista Día también, y un clic sobre una cita abre sus acciones, no Nueva cita", async () => {
    fijarAhora();
    simularMovil(true);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [citaEn("x", new Date(2030, 0, 7, 15, 0), 60)], total: 1, pagina: 1, tamano: 15,
    });
    const { onHuecoClick, onCitaClick } = renderizarConHueco();
    const bloque = await screen.findByRole("button", { name: /Cliente x, Corte/ });
    // Con el horario cargado la rejilla empieza a las 9, no a las 7 por defecto.
    await vi.waitFor(() => expect(screen.queryByText(formatHoraEje(7))).toBeNull());
    fireEvent.click(bloque);
    expect(onCitaClick).toHaveBeenCalledWith(expect.objectContaining({ id: "x" }), bloque);
    expect(onHuecoClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("columna-2030-01-07"), { clientY: yDe(17, 30) });
    expect(onHuecoClick).toHaveBeenCalledWith({ inicio: new Date(2030, 0, 7, 17, 30), empleadoId: undefined });
  });
});

describe("CalendarioCitas — una cita cancelada no tapa el hueco que dejó", () => {
  it("clic y puntero sobre el bloque ofrecen el hueco; la etiqueta abre la cita", async () => {
    fijarAhora();
    simularMovil(false);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [citaEn("x", new Date(2030, 0, 8, 16, 0), 60, { estado: 4, estadoTexto: "Cancelada" })],
      total: 1, pagina: 1, tamano: 15,
    });
    const { onHuecoClick, onCitaClick } = renderizarConHueco();
    const etiqueta = await screen.findByRole("button", { name: /Cliente x, Corte/ });
    await screen.findByText("Cerrado");
    const bloque = etiqueta.closest("[data-cita-fondo]") as HTMLElement;
    expect(bloque).not.toBeNull();
    expect(bloque).not.toHaveAttribute("data-cita");
    expect(bloque.className).toContain("pointer-events-none");

    // Puntero sobre la parte vacía del bloque: se ofrece "+ hora".
    fireEvent.mouseMove(bloque, { clientY: yDe(16) });
    expect(screen.getByText(/^\+ 4:00/)).toBeInTheDocument();
    // Clic: Nueva cita precargada con ese horario, no las acciones de la cancelada.
    fireEvent.click(bloque, { clientY: yDe(16, 20) });
    expect(onHuecoClick).toHaveBeenCalledWith({ inicio: new Date(2030, 0, 8, 16, 15), empleadoId: undefined });
    expect(onCitaClick).not.toHaveBeenCalled();

    // La etiqueta sigue abriendo la cita cancelada.
    onHuecoClick.mockClear();
    fireEvent.click(etiqueta);
    expect(onCitaClick).toHaveBeenCalledWith(expect.objectContaining({ id: "x" }), etiqueta);
    expect(onHuecoClick).not.toHaveBeenCalled();
  });
});

describe("CalendarioCitas — citas encimadas en Semana (I2)", () => {
  it("dos citas a la misma hora quedan lado a lado, cada una con su mitad y la hora completa", async () => {
    fijarAhora();
    simularMovil(false);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [citaEn("a", new Date(2030, 0, 8, 16, 0), 60), citaEn("b", new Date(2030, 0, 8, 16, 0), 45)],
      total: 2, pagina: 1, tamano: 15,
    });
    renderizarConHueco();
    const a = await screen.findByRole("button", { name: /Cliente a,/ });
    const b = screen.getByRole("button", { name: /Cliente b,/ });
    expect(a.style.left).not.toBe(b.style.left);
    expect(a.style.width).toContain("50%");
    expect(b.style.width).toContain("50%");
    // Angostas: la hora va en su propia línea, sin cortarse junto al nombre.
    expect(a.querySelector("p")?.textContent).toMatch(/^4:00/);
  });

  it("con más de tres encimadas, deja dos y agrupa el resto en '+N' que abre el día", async () => {
    fijarAhora();
    simularMovil(false);
    const d = new Date(2030, 0, 8, 16, 0);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: ["a", "b", "c", "d"].map((id) => citaEn(id, d, 60)), total: 4, pagina: 1, tamano: 15,
    });
    renderizarConHueco();
    await screen.findByRole("button", { name: /Cliente a,/ });
    expect(screen.getAllByRole("button", { name: /^4:00 .* Cliente/ })).toHaveLength(2);
    const mas = screen.getByRole("button", { name: /2 citas más/ });
    expect(mas).toHaveTextContent("+2");
    fireEvent.click(mas);
    expect(screen.getByRole("button", { name: "Vista día" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findAllByRole("button", { name: /^4:00 .* Cliente/ })).toHaveLength(4);
  });
});

describe("CalendarioCitas — barra de fecha compartida (I3)", () => {
  it("anterior, siguiente y Hoy mueven la semana y avisan a la página", async () => {
    fijarAhora();
    simularMovil(false);
    const onCambiarFecha = vi.fn();
    renderizarConHueco({ onCambiarFecha });
    expect(screen.getByText("7 ene — 13 ene 2030")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    expect(onCambiarFecha).toHaveBeenLastCalledWith("2030-01-14");
    expect(screen.getByText("14 ene — 20 ene 2030")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(onCambiarFecha).toHaveBeenLastCalledWith("2030-01-07");
    fireEvent.click(screen.getByRole("button", { name: "Vista día" }));
    fireEvent.click(screen.getByRole("button", { name: "Día anterior" }));
    expect(onCambiarFecha).toHaveBeenLastCalledWith("2030-01-06");
    expect(screen.getByText("Dom, 6 de ene 2030", { selector: "p[aria-live]" })).toBeInTheDocument();
  });

  it("respeta la fecha que le da la página (la misma que la Línea de tiempo)", () => {
    simularMovil(false);
    renderizarConHueco({ fecha: "2030-03-05" });
    expect(screen.getByText("4 mar — 10 mar 2030")).toBeInTheDocument();
  });
});

describe("CalendarioCitas — vista inicial (DC-23)", () => {
  it("en el teléfono abre en vista día", () => {
    simularMovil(true);
    renderizar();
    expect(screen.getByRole("button", { name: "Vista día" })).toHaveAttribute("aria-pressed", "true");
  });

  it("en escritorio abre en vista semana", () => {
    simularMovil(false);
    renderizar();
    expect(screen.getByRole("button", { name: "Vista semana" })).toHaveAttribute("aria-pressed", "true");
  });

  it("recuerda la vista elegida en este dispositivo", () => {
    simularMovil(true);
    const { unmount } = renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Vista semana" }));
    unmount();
    renderizar();
    expect(screen.getByRole("button", { name: "Vista semana" })).toHaveAttribute("aria-pressed", "true");
  });

  it("los controles de navegación tienen nombre y 44px en táctil", () => {
    simularMovil(true);
    renderizar();
    const anterior = screen.getByRole("button", { name: "Día anterior" });
    expect(anterior.className).toContain("min-h-[44px]");
  });
});

describe("CalendarioCitas — error (DC-32)", () => {
  it("un fallo al cargar se avisa con 'Reintentar' en vez de mostrar días vacíos", async () => {
    vi.mocked(citasApi.obtenerTodas).mockRejectedValueOnce(new Error("red"));
    renderizar();
    expect(await screen.findByText(/No se pudo cargar el calendario/)).toBeInTheDocument();
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 15 });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await vi.waitFor(() => expect(citasApi.obtenerTodas).toHaveBeenCalledTimes(2));
  });
});
