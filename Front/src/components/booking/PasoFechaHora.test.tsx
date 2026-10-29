import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import PasoFechaHora from "./PasoFechaHora";
import type { SlotDisponible } from "../../types";

vi.mock("../../api/publico", () => ({
  publicoApi: {
    obtenerDisponibilidad: vi.fn(),
    obtenerDisponibilidadSemana: vi.fn(),
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

const pad = (n: number) => String(n).padStart(2, "0");

/** Las `dias` fechas locales a partir de `desde` (YYYY-MM-DD). */
function fechasDesde(desde: string, dias: number): string[] {
  const [a, m, d] = desde.split("-").map(Number);
  return Array.from({ length: dias }, (_, i) => {
    const f = new Date(a, m - 1, d + i);
    return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
  });
}

/**
 * El backend responde, por día y por semana, lo que diga `horariosDe(fecha)`.
 * Así cada prueba describe la disponibilidad una vez y vale para las dos rutas.
 */
function responderPorFecha(horariosDe: (fecha: string) => SlotDisponible[]) {
  vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => horariosDe(fecha));
  vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockImplementation(async (_s, _e, desde, dias = 7) =>
    fechasDesde(desde, dias).map((fecha) => {
      const horarios = horariosDe(fecha);
      return { fecha, estado: horarios.length > 0 ? "con-horarios" : "sin-horarios", horarios };
    })
  );
}

const llamadasSemana = () => vi.mocked(publicoApi.obtenerDisponibilidadSemana).mock.calls;
const llamadasPorDia = () => vi.mocked(publicoApi.obtenerDisponibilidad).mock.calls;
const llamadasPara = (fecha: string) => llamadasPorDia().filter((c) => c[2] === fecha).length;

const slot = (fecha: string, hora = "10:00") => ({
  inicio: `${fecha}T${hora}:00`,
  fin: `${fecha}T${hora.slice(0, 2)}:30:00`,
  horaTexto: hora,
});

/** Botón de un día de octubre de 2026 por su número. */
const dia = (n: number) =>
  screen.getAllByRole("button").find((b) => b.getAttribute("data-fecha") === `2026-10-${pad(n)}`)!;

const errorDeRed = () => new Error("Network Error");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PasoFechaHora", () => {
  it("renders the heading without crashing", () => {
    responderPorFecha(() => []);
    renderConQuery();
    expect(screen.getByText("Elige fecha y hora")).toBeInTheDocument();
  });

  it("renders 7 day buttons plus navigation buttons for the current week", () => {
    responderPorFecha(() => []);
    renderConQuery();
    const allButtons = screen.getAllByRole("button");
    // 2 navigation + 7 day buttons = 9 total minimum
    expect(allButtons.length).toBeGreaterThanOrEqual(9);
  });

  it("shows loading spinner after a date is selected while the week loads", async () => {
    // Never-resolving promise keeps the week query in loading state
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockReturnValue(new Promise(() => {}));
    renderConQuery();

    const dayButtons = screen.getAllByRole("button").filter(
      (b) => b.hasAttribute("data-fecha") && !b.hasAttribute("disabled")
    );
    expect(dayButtons.length).toBeGreaterThan(0);

    fireEvent.click(dayButtons[0]);

    expect(await screen.findByText(/Cargando horarios/i)).toBeInTheDocument();
    // The chosen day waits for the week instead of firing its own request.
    expect(publicoApi.obtenerDisponibilidad).not.toHaveBeenCalled();
  });
});

// ── BF-05: la fecha se arma en hora local, nunca con toISOString() ─────────────
describe("PasoFechaHora — fecha local", () => {
  // Node relee la zona horaria cuando cambia la variable TZ; vi.unstubAllEnvs la restaura.
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("en México a las 19:00 marca y consulta la semana de hoy, no la de mañana", async () => {
    vi.stubEnv("TZ", "America/Mexico_City");
    // 01:00 UTC del 21 = 19:00 del 20 en Ciudad de México (UTC-6, sin horario de verano).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-21T01:00:00Z") });
    responderPorFecha(() => []);
    const { container } = renderConQuery();

    const hoy = container.querySelector('[aria-current="date"]');
    expect(hoy).toHaveTextContent("20");
    expect(publicoApi.obtenerDisponibilidadSemana).toHaveBeenCalledWith("srv-1", null, "2026-10-19", 7);

    await waitFor(() => expect(dia(20)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    fireEvent.click(dia(20));
    expect(dia(20)).toHaveAttribute("aria-pressed", "true");
  });

  it("en una zona adelantada a UTC pide la semana por su lunes local, no el día anterior", async () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T03:00:00Z") }); // 12:00 en Tokio
    responderPorFecha(() => []);
    renderConQuery();

    // Con toISOString() el lunes 19 a medianoche de Tokio caía en el 18.
    expect(publicoApi.obtenerDisponibilidadSemana).toHaveBeenCalledWith("srv-1", null, "2026-10-19", 7);

    await waitFor(() => expect(dia(25)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    fireEvent.click(dia(22));
    expect(dia(22)).toHaveAttribute("aria-pressed", "true");
  });

  it("si la semana falla, el día tocado se pide con su fecha local", async () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-20T03:00:00Z") });
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockRejectedValue(errorDeRed());
    vi.mocked(publicoApi.obtenerDisponibilidad).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "error"));

    fireEvent.click(dia(22));

    await waitFor(() => expect(publicoApi.obtenerDisponibilidad).toHaveBeenCalledWith("srv-1", null, "2026-10-22"));
  });
});

// ── Volver al paso con un horario ya elegido ──────────────────────────────────
describe("PasoFechaHora — horario previo", () => {
  it("reabre el día del horario elegido para que siga visible", () => {
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockReturnValue(new Promise(() => {}));
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const fecha = `${manana.getFullYear()}-${pad(manana.getMonth() + 1)}-${pad(manana.getDate())}`;
    renderConQuery({ seleccionado: { inicio: `${fecha}T10:00:00`, fin: `${fecha}T10:30:00`, horaTexto: "10:00" } });

    expect(publicoApi.obtenerDisponibilidadSemana).toHaveBeenCalledTimes(1);
    // El día queda abierto: muestra sus horarios (aquí, cargando) sin tocarlo.
    expect(screen.getByRole("button", { pressed: true, name: new RegExp(`^\\p{L}+ ${manana.getDate()} de`, "u") })).toBeInTheDocument();
    expect(screen.getByText(/Cargando horarios/i)).toBeInTheDocument();
  });
});

// ── BF-06: disponibilidad visible por día y salidas del estado vacío ──────────
describe("PasoFechaHora — disponibilidad de la semana", () => {
  /** Solo las fechas indicadas tienen horarios; el resto de la semana, ninguno. */
  const conHorariosEn = (...fechas: string[]) =>
    responderPorFecha((fecha) => (fechas.includes(fecha) ? [slot(fecha)] : []));

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

    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "con-horarios"));
    expect(dia(21)).toHaveAttribute("data-disponibilidad", "sin-horarios");
    expect(dia(21)).toBeEnabled();
  });

  it("abre solo el primer día con horarios", async () => {
    conHorariosEn("2026-10-23", "2026-10-24");
    renderConQuery();

    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
    expect(dia(23).getAttribute("style")).toContain("background");
  });

  it("en un día vacío ofrece el próximo día disponible", async () => {
    conHorariosEn("2026-10-23");
    renderConQuery();
    await waitFor(() => expect(dia(21)).toHaveAttribute("data-disponibilidad", "sin-horarios"));

    fireEvent.click(dia(21));
    fireEvent.click(await screen.findByRole("button", { name: "Próximo disponible: viernes 23" }));

    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
  });

  it("un día sin disponibilidad lo dice al elegirlo y pide escoger otro", async () => {
    conHorariosEn("2026-10-23");
    renderConQuery();
    await waitFor(() => expect(dia(21)).toHaveAttribute("data-disponibilidad", "sin-horarios"));

    expect(dia(21)).toHaveAccessibleName(/sin horarios disponibles$/);
    expect(dia(21).querySelector('[data-punto="sin-horarios"]')).toHaveClass("bg-slate-300");

    fireEvent.click(dia(21));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Sin horarios disponibles");
    expect(aviso).toHaveTextContent("Elige otro día.");
    expect(screen.getByRole("button", { name: "Próximo disponible: viernes 23" })).toBeInTheDocument();
  });

  it("la leyenda explica los puntos de disponibilidad", async () => {
    conHorariosEn("2026-10-23");
    renderConQuery();
    expect(await screen.findByText("Sin horarios")).toBeInTheDocument();
    // Sin calendario del negocio no se puede afirmar que un día esté cerrado.
    expect(screen.queryByText("Cerrado")).not.toBeInTheDocument();
    expect(screen.getByText("Con horarios")).toBeInTheDocument();
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
    await waitFor(() => expect(llamadasSemana().map((c) => c[2])).toContain("2026-10-26"));
  });

  it("sin enlace de lista de espera no la ofrece", async () => {
    conHorariosEn();
    renderConQuery();
    await screen.findByText("Sin disponibilidad esta semana");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// ── B3: una petición por semana, caché por día y caída a la consulta por día ──
describe("PasoFechaHora — consulta semanal", () => {
  const RESERVABLES = [20, 21, 22, 23, 24, 25];

  beforeEach(() => {
    // Martes 20 de octubre de 2026: la semana visible es lun 19 – dom 25 (reservables 20 – 25).
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pide toda la semana en una sola petición y abrir otros días no vuelve a pedirlos", async () => {
    responderPorFecha((fecha) => (fecha === "2026-10-23" || fecha === "2026-10-24" ? [slot(fecha)] : []));
    renderConQuery();

    expect(await screen.findByRole("button", { name: "10:00" })).toBeInTheDocument();
    fireEvent.click(dia(24));
    expect(dia(24)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "10:00" })).toBeInTheDocument();
    fireEvent.click(dia(21));
    expect(await screen.findByText("Sin horarios disponibles")).toBeInTheDocument();

    expect(llamadasSemana()).toEqual([["srv-1", null, "2026-10-19", 7]]);
    expect(publicoApi.obtenerDisponibilidad).not.toHaveBeenCalled();
  });

  it("lleva el empleado elegido en la consulta semanal", async () => {
    responderPorFecha(() => []);
    renderConQuery({ empleadoId: "emp-9" });

    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    expect(llamadasSemana()).toEqual([["srv-1", "emp-9", "2026-10-19", 7]]);
  });

  it("si la semana falla tras un reintento, los días quedan sin revisar y no se piden uno por uno", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockRejectedValue(errorDeRed());
    renderConQuery();

    await waitFor(() => {
      for (const n of RESERVABLES) expect(dia(n)).toHaveAttribute("data-disponibilidad", "error");
    });
    expect(llamadasSemana()).toHaveLength(2);
    expect(publicoApi.obtenerDisponibilidad).not.toHaveBeenCalled();
    expect(dia(21)).toHaveAccessibleName(/no se pudo cargar; toca para reintentar/);
    // Sin punto: no sabemos si hay horarios, así que no se pinta ni gris ni rojo.
    expect(dia(21).querySelector('[data-punto="error"]')!.className).not.toMatch(/bg-/);
    expect(screen.getByText(/No pudimos revisar algunos días/)).toBeInTheDocument();
  });

  it("si la semana falla, tocar un día pide solo ese día", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockRejectedValue(errorDeRed());
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => [slot(fecha, "11:00")]);
    renderConQuery();
    await waitFor(() => expect(dia(21)).toHaveAttribute("data-disponibilidad", "error"));

    fireEvent.click(dia(21));

    expect(await screen.findByRole("button", { name: "11:00" })).toBeInTheDocument();
    expect(dia(21)).toHaveAttribute("data-disponibilidad", "con-horarios");
    expect(llamadasPorDia().map((c) => c[2])).toEqual(["2026-10-21"]);
  });

  it("con un horario previo y la semana caída, el día elegido se pide y reintenta", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockRejectedValue(errorDeRed());
    let intentos = 0;
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => {
      intentos += 1;
      if (intentos === 1) throw errorDeRed();
      return [slot(fecha)];
    });
    renderConQuery({ seleccionado: slot("2026-10-22") });

    expect(await screen.findByRole("button", { name: "10:00" }, { timeout: 3000 })).toBeInTheDocument();
    expect(intentos).toBe(2);
    expect(llamadasPorDia().every((c) => c[2] === "2026-10-22")).toBe(true);
  });

  it("un día que no se pudo revisar no se presenta como sin horarios, y se puede reintentar", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockRejectedValue(errorDeRed());
    let fallar = true;
    vi.mocked(publicoApi.obtenerDisponibilidad).mockImplementation(async (_s, _e, fecha) => {
      if (fallar) throw errorDeRed();
      return [slot(fecha, "11:00")];
    });
    renderConQuery();
    await waitFor(() => expect(dia(21)).toHaveAttribute("data-disponibilidad", "error"));

    fireEvent.click(dia(21));

    expect(await screen.findByText("No pudimos revisar este día.", undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText("Sin horarios disponibles")).not.toBeInTheDocument();

    fallar = false;
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    expect(await screen.findByRole("button", { name: "11:00" })).toBeInTheDocument();
  });

  it("mientras llega la semana no abre ningún día", async () => {
    vi.mocked(publicoApi.obtenerDisponibilidadSemana).mockReturnValue(new Promise(() => {}));
    renderConQuery();

    for (const n of RESERVABLES) expect(dia(n)).toHaveAttribute("data-disponibilidad", "cargando");
    expect(screen.queryByRole("button", { pressed: true })).not.toBeInTheDocument();
  });

  it("volver a una semana ya vista reutiliza la caché", async () => {
    responderPorFecha(() => []);
    renderConQuery();
    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "sin-horarios"));

    fireEvent.click(screen.getByRole("button", { name: "Semana siguiente" }));
    await waitFor(() => expect(llamadasSemana().map((c) => c[2])).toContain("2026-10-26"));
    fireEvent.click(screen.getByRole("button", { name: "Semana anterior" }));

    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    expect(llamadasSemana().map((c) => c[2])).toEqual(["2026-10-19", "2026-10-26"]);
  });
});

describe("PasoFechaHora — cambio de semana con un horario elegido", () => {
  const elegido = { inicio: "2026-10-22T10:00:00", fin: "2026-10-22T10:30:00", horaTexto: "10:00" };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
    responderPorFecha((fecha) => (fecha === "2026-10-22" ? [elegido] : []));
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
    responderPorFecha((fecha) => (fecha === "2026-10-22" ? [elegido] : []));
    renderConQuery({ seleccionado: elegido });

    expect(screen.getByRole("button", { name: /^martes 20 de octubre, hoy/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^jueves 22 de octubre/ })).toHaveAttribute("aria-pressed", "true");

    const grupo = await screen.findByRole("group", { name: "Mañana" });
    expect(within(grupo).getByRole("button", { name: "10:00" })).toHaveAttribute("aria-pressed", "true");
  });
});

// ── Días cerrados según el horario del negocio, no por una lista de horarios vacía ──
describe("PasoFechaHora — calendario del negocio", () => {
  // Abre lunes, martes, jueves, viernes y sábado de 9 a 18; miércoles y domingo cierra.
  // El sábado 24 está bloqueado (feriado).
  const calendario = {
    horario: [1, 2, 4, 5, 6].map((diaSemana) => ({ diaSemana, horaInicio: "09:00", horaFin: "18:00" })),
    diasCerrados: ["2026-10-24"],
    zonaHoraria: null,
  };

  beforeEach(() => {
    responderPorFecha((fecha) => (fecha === "2026-10-23" ? [slot(fecha)] : []));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marca en rojo los días que no abre o están bloqueados, sin pedirlos por separado", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
    renderConQuery({ calendario });

    await waitFor(() => expect(dia(22)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    for (const n of [21, 24, 25]) {
      expect(dia(n)).toHaveAttribute("data-disponibilidad", "cerrado");
      expect(dia(n)).toHaveAccessibleName(/, cerrado$/);
      expect(dia(n).querySelector('[data-punto="cerrado"]')).toHaveClass("bg-status-cancelled-dot");
      expect(llamadasPara(`2026-10-${n}`)).toBe(0);
    }
    // Abre, pero no le quedan horarios: gris, no rojo.
    expect(dia(22).querySelector('[data-punto="sin-horarios"]')).toHaveClass("bg-slate-300");
    expect(screen.getByText("Cerrado")).toBeInTheDocument();
  });

  it("al tocar un día cerrado lo dice y ofrece el próximo disponible", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 12) });
    renderConQuery({ calendario });
    await waitFor(() => expect(dia(23)).toHaveAttribute("data-disponibilidad", "con-horarios"));

    fireEvent.click(dia(21));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Cerrado");
    expect(aviso).not.toHaveTextContent("Sin horarios disponibles");
    expect(screen.getByRole("button", { name: "Próximo disponible: viernes 23" })).toBeInTheDocument();
    expect(llamadasPara("2026-10-21")).toBe(0);
  });

  it("hoy, pasada la hora de cierre, el día dice «Cerrado por hoy»", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 18, 30) });
    renderConQuery({ calendario });

    expect(dia(20)).toHaveAttribute("data-disponibilidad", "cerrado-hoy");
    expect(dia(20)).toHaveAccessibleName(/cerrado por hoy$/);
    expect(dia(20).querySelector('[data-punto="cerrado-hoy"]')).toHaveClass("bg-status-cancelled-dot");

    fireEvent.click(dia(20));
    expect(await screen.findByRole("status")).toHaveTextContent("Cerrado por hoy");
    expect(llamadasPara("2026-10-20")).toBe(0);
  });

  it("hoy, antes del cierre y sin horarios libres, es gris y no cerrado", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 20, 17, 0) });
    renderConQuery({ calendario });

    await waitFor(() => expect(dia(20)).toHaveAttribute("data-disponibilidad", "sin-horarios"));
    expect(dia(20)).toHaveAccessibleName(/sin horarios disponibles$/);
  });

  it("una semana sin ningún día abierto no se consulta", async () => {
    // Domingo 25 a las 12: solo queda el propio domingo, que no abre.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 25, 12) });
    renderConQuery({ calendario });

    expect(dia(25)).toHaveAttribute("data-disponibilidad", "cerrado");
    expect(publicoApi.obtenerDisponibilidadSemana).not.toHaveBeenCalled();
    expect(publicoApi.obtenerDisponibilidad).not.toHaveBeenCalled();
  });
});
