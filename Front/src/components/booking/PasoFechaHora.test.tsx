import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

    // Day buttons have no aria-label; nav buttons do. Enabled day buttons are not disabled.
    const dayButtons = screen.getAllByRole("button").filter(
      (b) => !b.hasAttribute("disabled") && !b.getAttribute("aria-label")
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

  /** Botón de día por su número visible (los de navegación llevan aria-label). */
  const botonDia = (numero: number) =>
    screen.getAllByRole("button").find((b) => !b.getAttribute("aria-label") && b.textContent?.endsWith(String(numero)))!;

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
    screen.getAllByRole("button").find((b) => !b.getAttribute("aria-label") && b.textContent === `${["Do","Lu","Ma","Mi","Ju","Vi","Sá"][new Date(2026, 9, n).getDay()]}${n}`)!;

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
