import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import PasoFechaHora from "./PasoFechaHora";

vi.mock("../../api/publico", () => ({
  publicoApi: {
    obtenerDisponibilidad: vi.fn(),
  },
}));

import { publicoApi } from "../../api/publico";

function renderConQuery(props: Partial<React.ComponentProps<typeof PasoFechaHora>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  const defaults = {
    servicioId: "srv-1",
    empleadoId: null,
    seleccionado: null,
    onSeleccionar: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PasoFechaHora {...defaults} {...props} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PasoFechaHora", () => {
  it("renders the heading without crashing", () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();
    expect(screen.getByText("Elige fecha y hora")).toBeInTheDocument();
  });

  it("renders 7 day buttons plus navigation buttons for the current week", () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();
    const allButtons = screen.getAllByRole("button");
    // 2 navigation + 7 day buttons = 9 total minimum
    expect(allButtons.length).toBeGreaterThanOrEqual(9);
  });

  it("shows loading spinner after a date is selected", async () => {
    // Never-resolving promise keeps query in loading state
    vi.mocked(publicoApi.obtenerDisponibilidad).mockReturnValue(new Promise(() => {}));
    renderConQuery();

    const dayButtons = screen.getAllByRole("button").filter(
      (b) => b.hasAttribute("data-fecha") && !b.hasAttribute("disabled")
    );
    expect(dayButtons.length).toBeGreaterThan(0);

    fireEvent.click(dayButtons[0]);

    expect(await screen.findByText(/Cargando horarios/i)).toBeInTheDocument();
  });
});

// ── BF-05: la fecha se arma en hora local, nunca con toISOString() ─────────────
describe("PasoFechaHora — fecha local", () => {
  // Node relee la zona horaria cuando cambia la variable TZ; vi.unstubAllEnvs la restaura.
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  /** Botón de día por su número de día del mes. */
  const botonDia = (numero: number) =>
    screen.getAllByRole("button").find((b) => b.getAttribute("data-fecha")?.endsWith(`-${numero}`))!;

  it("en México a las 19:00 marca y consulta el día de hoy, no el de mañana", () => {
    vi.stubEnv("TZ", "America/Mexico_City");
    // 01:00 UTC del 21 = 19:00 del 20 en Ciudad de México (UTC-6, sin horario de verano).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T01:00:00Z") });
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    const { container } = renderConQuery();

    const hoy = container.querySelector('[aria-current="date"]');
    expect(hoy).toHaveTextContent("20");

    fireEvent.click(botonDia(20));

    expect(publicoApi.obtenerDisponibilidad).toHaveBeenCalledWith("srv-1", null, "2026-10-20");
  });

  it("en una zona adelantada a UTC consulta el día tocado, no el anterior", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T03:00:00Z") }); // 12:00 en Tokio
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();

    fireEvent.click(botonDia(22));

    expect(publicoApi.obtenerDisponibilidad).toHaveBeenCalledWith("srv-1", null, "2026-10-22");
    // La semana visible (mar 20 – dom 25) se pide con sus fechas locales; con
    // toISOString() cada día caía en el anterior (19 … 24).
    const fechas = vi.mocked(publicoApi.obtenerDisponibilidad).mock.calls.map((c) => c[2]);
    expect(fechas).toContain("2026-10-25");
    expect(fechas).not.toContain("2026-10-19");
  });
});

// ── Volver al paso con un horario ya elegido ──────────────────────────────────
describe("PasoFechaHora — horario previo", () => {
  it("reabre el día del horario elegido para que siga visible", () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockReturnValue(new Promise(() => {}));
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dia = `${manana.getFullYear()}-${pad(manana.getMonth() + 1)}-${pad(manana.getDate())}`;
    renderConQuery({ seleccionado: { inicio: `${dia}T10:00:00`, fin: `${dia}T10:30:00`, horaTexto: "10:00" } });

    expect(publicoApi.obtenerDisponibilidad).toHaveBeenCalledWith("srv-1", null, dia);
    // El día queda abierto: muestra sus horarios (aquí, cargando) sin tocarlo.
    expect(screen.getByText(/Cargando horarios/i)).toBeInTheDocument();
  });
});

// ── BF-06: disponibilidad visible por día y salidas del estado vacío ──────────
describe("PasoFechaHora — disponibilidad de la semana", () => {
  const slot = (fecha: string, hora = "10:00") => ({
    inicio: `${fecha}T${hora}:00`,
    fin: `${fecha}T${hora.slice(0, 2)}:30:00`,
    horaTexto: hora,
  });

  /** Solo las fechas indicadas tienen horarios; el resto de la semana, ninguno. */
  function conHorariosEn(...fechas: string[]) {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) =>
      fechas.includes(fecha) ? [slot(fecha)] : []
    );
  }

  const diaPorNumero = (n: number) =>
    screen.getAllByRole("button").find((b) => b.getAttribute("data-fecha") === `2026-10-${String(n).padStart(2, "0")}`)!;

  beforeEach(() => {
    // Martes 20 de octubre de 2026, 12:00 locales: la semana visible es lun 19 – dom 25.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca qué días tienen horarios sin deshabilitar los que no", async () => {
    conHorariosEn("2026-10-22");
    renderConQuery();

    await waitFor(() => expect(diaPorNumero(22)).toHaveAttribute("data-disponibilidad", "con-horarios"));
    await waitFor(() => expect(diaPorNumero(21)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    expect(diaPorNumero(21)).toBeEnabled();
  });

  it("abre solo el primer día con horarios", async () => {
    conHorariosEn("2026-10-23", "2026-10-24");
    renderConQuery();

    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(diaPorNumero(23).getAttribute("style")).toContain("background");
  });

  it("en un día vacío ofrece el próximo día disponible", async () => {
    conHorariosEn("2026-10-23");
    renderConQuery();
    await waitFor(() => expect(diaPorNumero(21)).toHaveAttribute("data-disponibilidad", "sin-horarios"));

    fireEvent.click(diaPorNumero(21));
    fireEvent.click(await screen.findByRole("button", { name: "Próximo disponible: viernes 23" }));

    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
  });

  it("con la semana vacía ofrece la siguiente y la lista de espera", async () => {
    conHorariosEn();
    renderConQuery({ enlaceListaEspera: "/b/salon-test/espera?servicioId=srv-1" });

    expect(await screen.findByText("Sin disponibilidad esta semana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Únete a la lista de espera" })).toHaveAttribute(
      "href",
      "/b/salon-test/espera?servicioId=srv-1"
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver la semana siguiente" }));
    await waitFor(() =>
      expect(vi.mocked(publicoApi.obtenerDisponibilidad).mock.calls.map((c) => c[2])).toContain("2026-10-26")
    );
  });

  it("sin enlace de lista de espera no la ofrece", async () => {
    conHorariosEn();
    renderConQuery();
    await screen.findByText("Sin disponibilidad esta semana");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// ── Revisión: precarga sin reintentos, días con error y cambio de semana ──────
describe("PasoFechaHora — precarga y errores por día", () => {
  const slot = (fecha: string, hora = "10:00") => ({
    inicio: `${fecha}T${hora}:00`,
    fin: `${fecha}T${hora.slice(0, 2)}:30:00`,
    horaTexto: hora,
  });
  const dia = (n: number) =>
    screen.getAllByRole("button").find((b) => b.getAttribute("data-fecha") === `2026-10-${String(n).padStart(2, "0")}`)!;
  const llamadasPara = (fecha: string) =>
    vi.mocked(publicoApi.obtenerDisponibilidad).mock.calls.filter((c) => c[2] === fecha).length;
  const errorDeRed = () => new Error("Network Error");
  const RESERVABLES = [20, 21, 22, 23, 24, 25];

  beforeEach(() => {
    // Martes 20 de octubre de 2026: la semana visible es lun 19 – dom 25 (reservables 20 – 25).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("la precarga de la semana no reintenta: una sola petición por día que falla", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockRejectedValue(errorDeRed());
    renderConQuery();

    // Con los reintentos heredados (2 × 1 s) ningún día llegaría a «error» a tiempo.
    await waitFor(() => {
      for (const n of RESERVABLES) expect(dia(n)).toHaveAttribute("data-disponibilidad", "error");
    });
    for (const n of RESERVABLES) expect(llamadasPara(`2026-10-${n}`)).toBe(1);
  });

  it("el día elegido sí reintenta antes de darse por fallido", async () => {
    let intentos = 0;
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => {
      if (fecha !== "2026-10-22") return [];
      intentos += 1;
      if (intentos === 1) throw errorDeRed();
      return [slot(fecha)];
    });
    renderConQuery({ seleccionado: slot("2026-10-22") });

    expect(await screen.findByRole("button", { name: "10:00" }, { timeout: 3000 })).toBeInTheDocument();
    expect(intentos).toBe(2);
  });

  it("volver a una semana ya vista reutiliza la caché", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "sin-horarios"));

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    await waitFor(() => expect(llamadasPara("2026-10-26")).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));

    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    expect(llamadasPara("2026-10-22")).toBe(1);
  });

  it("un día que falla no frena la apertura automática de los siguientes y se marca", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => {
      if (fecha === "2026-10-21") throw errorDeRed();
      return fecha === "2026-10-23" ? [slot(fecha)] : [];
    });
    renderConQuery();

    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(dia(23)).toHaveAttribute("aria-pressed", "true");
    expect(dia(21)).toHaveAttribute("data-disponibilidad", "error");
    expect(dia(21)).toHaveAccessibleName(/no se pudo cargar; toca para reintentar/);
    expect(screen.getByText(/No pudimos revisar algunos días/)).toBeInTheDocument();
  });

  it("espera a un día anterior que sigue cargando antes de abrir uno posterior", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation((_s, _e, fecha) =>
      fecha === "2026-10-21" ? new Promise(() => {}) : Promise.resolve(fecha === "2026-10-23" ? [slot(fecha)] : [])
    );
    renderConQuery();

    await waitFor(() => expect(dia(23)).toHaveAttribute("data-disponibilidad", "con-horarios"));
    expect(dia(23)).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "10:00" })).not.toBeInTheDocument();
  });

  it("tocar un día que falló lo vuelve a pedir", async () => {
    let fallar = true;
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => {
      if (fecha === "2026-10-21" && fallar) throw errorDeRed();
      return fecha === "2026-10-21" ? [slot(fecha, "11:00")] : [];
    });
    renderConQuery();
    await waitFor(() => expect(dia(21)).toHaveAttribute("data-disponibilidad", "error"));

    fallar = false;
    fireEvent.click(dia(21));

    expect(await screen.findByRole("button", { name: "11:00" })).toBeInTheDocument();
    expect(llamadasPara("2026-10-21")).toBe(2);
  });
});

describe("PasoFechaHora — cambio de semana con un horario elegido", () => {
  const elegido = { inicio: "2026-10-22T10:00:00", fin: "2026-10-22T10:30:00", horaTexto: "10:00" };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([elegido]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suelta el horario al pasar a otra semana para no continuar con uno invisible", () => {
    const onLimpiarSlot = vi.fn();
    renderConQuery({ seleccionado: elegido, onLimpiarSlot });

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));

    expect(onLimpiarSlot).toHaveBeenCalledTimes(1);
  });

  it("sin horario elegido, cambiar de semana no avisa al padre", () => {
    const onLimpiarSlot = vi.fn();
    renderConQuery({ onLimpiarSlot });

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));

    expect(onLimpiarSlot).not.toHaveBeenCalled();
  });
});

// ── BF-22: estado y fecha completa para lectores de pantalla ──────────────────
describe("PasoFechaHora — accesibilidad", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cada día dice su fecha completa, si es hoy y si está elegido", async () => {
    const elegido = { inicio: "2026-10-22T10:00:00", fin: "2026-10-22T10:30:00", horaTexto: "10:00" };
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([elegido]);
    renderConQuery({ seleccionado: elegido });

    expect(screen.getByRole("button", { name: /^martes 20 de octubre, hoy/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^jueves 22 de octubre/ })).toHaveAttribute("aria-pressed", "true");

    const grupo = await screen.findByRole("group", { name: "Mañana" });
    expect(within(grupo).getByRole("button", { name: "10:00" })).toHaveAttribute("aria-pressed", "true");
  });
});
