import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import InicioPage from "./InicioPage";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mockToast = vi.hoisted(() => vi.fn());

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("../../store/toastStore", () => ({
  useToastStore: vi.fn(// eslint-disable-next-line @typescript-eslint/no-explicit-any
(selector: (s: any) => unknown) =>
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

vi.mock("../../api/intake", () => ({
  intakeApi: { getRespuestas: vi.fn().mockResolvedValue([]) },
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
  useReducedMotion: () => false,
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

// VistaPropietario sustituye todo el panel por BienvenidaScreen mientras el
// negocio no tenga servicios y al menos un día de horario activo. Para probar
// el panel real (KPIs, wizard, gráfica) hay que partir de un negocio ya
// configurado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockServicios: any = [
  { id: "srv-1", nombre: "Corte de cabello", duracionMinutos: 30, precio: 200, activo: true },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockHorarios: any = [
  { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "18:00" }] },
];

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
  vi.mocked(useAuthStore).mockImplementation(// eslint-disable-next-line @typescript-eslint/no-explicit-any
(selector: (s: any) => unknown) =>
    selector({ usuario: propietarioUser })
  );

  // API defaults
  vi.mocked(dashboardApi.obtenerResumen).mockResolvedValue(mockResumen);
  vi.mocked(dashboardApi.obtenerTendencia).mockResolvedValue([]);
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue(emptyPage);
  vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue(mockNegocio);
  vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue(mockHorarios);
  vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
  vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
  vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue(mockServicios);
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

    // Los mismos nombres de periodo que Citas, Pagos y Reportes.
    const semanaLabels = screen.getAllByText("Esta semana");
    expect(semanaLabels.length).toBeGreaterThanOrEqual(1);

    const mesLabels = screen.getAllByText("Este mes");
    expect(mesLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("muestra la pantalla de bienvenida en lugar del panel cuando aún no hay servicios", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);

    renderConQuery();

    expect(
      await screen.findByText("Tu página está casi lista")
    ).toBeInTheDocument();
    // La bienvenida reemplaza KPIs, wizard y gráfica mientras falte configuración.
    expect(screen.queryByText("Configura tu negocio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "14d" })).not.toBeInTheDocument();
  });
});

// ── 1b. G1: el onboarding solo con datos reales ───────────────────────────────
describe("InicioPage — carga y error no muestran el onboarding (G1)", () => {
  // Una promesa que nunca resuelve deja la consulta cargando.
  const nunca = () => new Promise<never>(() => {});

  it("mientras carga muestra el skeleton, no la bienvenida ni la guía", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.mocked(dashboardApi.obtenerResumen).mockImplementation(nunca);
    vi.mocked(serviciosApi.obtenerTodos).mockImplementation(nunca);
    vi.mocked(negociosApi.obtenerHorarios).mockImplementation(nunca);

    const { container } = renderConQuery();

    // Dar tiempo a que el resto de consultas resuelvan.
    await waitFor(() => expect(negociosApi.obtenerPerfil).toHaveBeenCalled());
    await screen.findByText("Salón Test");
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("Tu página está casi lista")).toBeNull();
    expect(screen.queryByText(/Faltan \d pasos?/)).toBeNull();
    expect(screen.queryByText("Configura tu negocio")).toBeNull();
  });

  it("con el resumen cargado pero servicios y horarios aún en camino, no asume que faltan", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.mocked(serviciosApi.obtenerTodos).mockImplementation(nunca);
    vi.mocked(negociosApi.obtenerHorarios).mockImplementation(nunca);

    renderConQuery();

    await waitFor(() => expect(dashboardApi.obtenerResumen).toHaveBeenCalled());
    await screen.findByText("Salón Test");
    expect(screen.queryByText("Tu página está casi lista")).toBeNull();
    expect(screen.queryByText("Configura tu negocio")).toBeNull();
  });

  it("si el resumen falla muestra solo ErrorCarga con Reintentar", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.mocked(dashboardApi.obtenerResumen).mockRejectedValue(new Error("500"));
    // Incluso con un negocio sin servicios: el error no se convierte en bienvenida.
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);

    renderConQuery();

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("No se pudo cargar el resumen del negocio.")).toBeInTheDocument();
    expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText("Tu página está casi lista")).toBeNull();
    expect(screen.queryByText("Configura tu negocio")).toBeNull();
    expect(screen.queryByText("Agenda de hoy")).toBeNull();
  });

  it("Reintentar vuelve a pedir el resumen", async () => {
    vi.mocked(dashboardApi.obtenerResumen).mockRejectedValueOnce(new Error("500"));

    renderConQuery();

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Agenda de hoy" })).toBeInTheDocument();
    expect(dashboardApi.obtenerResumen).toHaveBeenCalledTimes(2);
  });

  it("si fallan servicios u horarios no muestra la bienvenida", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.mocked(serviciosApi.obtenerTodos).mockRejectedValue(new Error("500"));

    renderConQuery();

    expect(await screen.findByRole("heading", { name: "Agenda de hoy" })).toBeInTheDocument();
    expect(screen.queryByText("Tu página está casi lista")).toBeNull();
    expect(screen.queryByText("Configura tu negocio")).toBeNull();
  });

  it("el subtítulo muestra el nombre del negocio, no 'Tu negocio'", async () => {
    renderConQuery();

    expect(await screen.findByText("Salón Test")).toBeInTheDocument();
    expect(screen.queryByText("Tu negocio")).toBeNull();
  });

  it("mientras llega el perfil no muestra 'Tu negocio'", async () => {
    vi.mocked(negociosApi.obtenerPerfil).mockImplementation(nunca);

    renderConQuery();

    await screen.findByRole("heading", { level: 1, name: "Hola, Roberto" });
    expect(screen.queryByText("Tu negocio")).toBeNull();
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

    const guia = await screen.findByRole("region", { name: "Configura tu negocio" });
    fireEvent.click(within(guia).getByRole("button", { name: "Cerrar la guía de inicio" }));

    await waitFor(() =>
      expect(screen.queryByText("Configura tu negocio")).not.toBeInTheDocument()
    );
    expect(setItemSpy).toHaveBeenCalledWith("onboarding-ok-neg-1", "1");
  });

  it("la guía va después de 'Agenda de hoy' y empieza plegada con el siguiente paso", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

    renderConQuery();

    const guia = await screen.findByRole("region", { name: "Configura tu negocio" });
    const agenda = screen.getByRole("heading", { name: "Agenda de hoy" });
    // La agenda del día precede a la guía en el documento.
    expect(agenda.compareDocumentPosition(guia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Plegada: progreso y siguiente paso pendiente, sin la lista completa.
    expect(within(guia).getByText("3/7 completados")).toBeInTheDocument();
    expect(within(guia).getByText("Agrega tu equipo")).toBeInTheDocument();
    expect(within(guia).queryByText("Sube fotos a tu galería")).toBeNull();

    const alternar = within(guia).getByRole("button", { name: "Ver todos los pasos" });
    expect(alternar).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(alternar);
    expect(within(guia).getByRole("button", { name: "Ocultar pasos" })).toHaveAttribute("aria-expanded", "true");
    expect(within(guia).getByText("Sube fotos a tu galería")).toBeInTheDocument();
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

// ── 5. Today's agenda leads the owner home ────────────────────────────────────
describe("InicioPage — agenda de hoy", () => {
  it("el panel ya no repite el menú en una rejilla de accesos y enlaza a la lista de citas", async () => {
    renderConQuery();
    expect(await screen.findByRole("link", { name: "Ver todas las citas" })).toHaveAttribute("href", "/dashboard/citas");
    expect(screen.queryByRole("link", { name: /reportes/i })).toBeNull();
  });

  it("cada cita de la agenda trae sus acciones (confirmar y hoja con reagendar)", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      ...emptyPage,
      datos: [{
        id: "c1", codigoConfirmacion: "X1", clienteId: "cl1", empleadoId: "e1", servicioId: "s1",
        nombreCliente: "Ana López", telefonoCliente: "5511223344", nombreEmpleado: "María",
        nombreServicio: "Corte", duracionMinutos: 30, precio: 200, pagada: false,
        inicioEn: new Date(Date.now() + 3_600_000).toISOString(),
        finEn: new Date(Date.now() + 5_400_000).toISOString(),
        estado: 1, estadoTexto: "Pendiente",
      }],
      total: 1,
    });
    renderConQuery();
    expect(await screen.findByRole("button", { name: "Confirmar cita de Ana López" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acciones de la cita de Ana López" })).toBeInTheDocument();
  });
});

// ── 5b. "Hoy" en hora local (DC-04) ───────────────────────────────────────────
describe("InicioPage — 'hoy' se calcula en hora local", () => {
  beforeEach(() => {
    vi.stubEnv("TZ", "America/Mexico_City");
    // 19:30 del 20 de octubre en CDMX = 01:30 UTC del 21: toISOString() ya diría "mañana".
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T01:30:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("la agenda del propietario pide las citas del día local, no del día UTC", async () => {
    renderConQuery();
    await waitFor(() =>
      expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
        expect.objectContaining({ desde: "2026-10-20", hasta: "2026-10-20" })
      )
    );
    expect(citasApi.obtenerTodas).not.toHaveBeenCalledWith(expect.objectContaining({ desde: "2026-10-21", hasta: "2026-10-21" }));
  });

  it("la agenda del empleado pide hoy, mañana y la semana en hora local", async () => {
    vi.mocked(useAuthStore).mockImplementation(// eslint-disable-next-line @typescript-eslint/no-explicit-any
(selector: (s: any) => unknown) => selector({ usuario: empleadoUser }));
    renderConQuery();
    await waitFor(() =>
      expect(citasApi.obtenerTodas).toHaveBeenCalledWith({ desde: "2026-10-20", hasta: "2026-10-20" })
    );
    expect(citasApi.obtenerTodas).toHaveBeenCalledWith({ desde: "2026-10-21" });
    // Martes 20 → semana del lunes 19 al domingo 25.
    expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
      expect.objectContaining({ desde: "2026-10-19", hasta: "2026-10-25" })
    );
  });
});

// ── 6. Employee view renders ──────────────────────────────────────────────────
describe("InicioPage — vista empleado", () => {
  it("renders employee name as heading and shows stat section labels", async () => {
    vi.mocked(useAuthStore).mockImplementation(// eslint-disable-next-line @typescript-eslint/no-explicit-any
(selector: (s: any) => unknown) =>
      selector({ usuario: empleadoUser })
    );

    renderConQuery();

    // First name extracted from "Ana García"; same greeting as the owner's Inicio (M10).
    expect(
      await screen.findByRole("heading", { level: 1, name: "Hola, Ana" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Buen(os|as) (días|tardes|noches)$/)).toBeNull();

    // Stat labels render before query data arrives
    expect(screen.getByText("Citas hoy")).toBeInTheDocument();
    expect(screen.getByText("Completadas")).toBeInTheDocument();
  });
});

describe("InicioPage — agenda del empleado (DC-15)", () => {
  const citaEmpleado = (estadoTexto: string, desfaseInicioMs: number) => ({
    id: `c-${estadoTexto}`, codigoConfirmacion: "X1", clienteId: "cl1", empleadoId: "e1", servicioId: "s1",
    nombreCliente: "Ana López", telefonoCliente: "", nombreEmpleado: "Ana",
    nombreServicio: "Corte", duracionMinutos: 30, precio: 200, pagada: false,
    inicioEn: new Date(Date.now() + desfaseInicioMs).toISOString(),
    finEn: new Date(Date.now() + desfaseInicioMs + 1_800_000).toISOString(),
    estado: 1, estadoTexto,
  });

  beforeEach(() => {
    vi.mocked(useAuthStore).mockImplementation(// eslint-disable-next-line @typescript-eslint/no-explicit-any
(selector: (s: any) => unknown) => selector({ usuario: empleadoUser }));
  });

  it("tocar la cita abre sus acciones de la cita, sin acciones del cliente", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ ...emptyPage, datos: [citaEmpleado("Pendiente", 3_600_000)], total: 1 });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Ana López, Corte\. Ver acciones/ }));
    const hoja = await screen.findByRole("dialog");
    expect(within(hoja).getByRole("button", { name: "Confirmar cita" })).toBeInTheDocument();
    expect(within(hoja).queryByRole("button", { name: /Ver historial/ })).not.toBeInTheDocument();
    expect(within(hoja).queryByRole("link", { name: /Ver historial/ })).not.toBeInTheDocument();
  });

  it("una cita que ya terminó y sigue confirmada dice 'Por cerrar' y muestra Completar en la fila", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ ...emptyPage, datos: [citaEmpleado("Confirmada", -7_200_000)], total: 1 });
    renderConQuery();
    expect(await screen.findByText("Por cerrar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completar cita de Ana López" })).toBeInTheDocument();
  });

  it("'Citas hoy' no cuenta canceladas ni inasistencias (G3)", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      ...emptyPage,
      datos: [
        { ...citaEmpleado("Confirmada", 3_600_000), id: "c-1" },
        { ...citaEmpleado("Cancelada", 7_200_000), id: "c-2" },
        { ...citaEmpleado("Inasistencia", -7_200_000), id: "c-3" },
      ],
      total: 3,
    });
    renderConQuery();
    await screen.findAllByText("Ana López");
    const tarjeta = screen.getByText("Citas hoy").parentElement!;
    expect(within(tarjeta).getByText("1")).toBeInTheDocument();
  });

  it("la fila de la agenda usa la gramática de la dueña: hora en línea, sin barra de color (M10)", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ ...emptyPage, datos: [citaEmpleado("Confirmada", 3_600_000)], total: 1 });
    renderConQuery();
    const fila = await screen.findByRole("button", { name: /Ana López, Corte\. Ver acciones/ });
    const hora = fila.firstElementChild!;
    expect(hora.className).toContain("w-16");
    expect(hora.className).toContain("whitespace-nowrap");
    expect(within(fila).getByText(/30 min · \$200/)).toBeInTheDocument();
    expect(fila.querySelector(".w-1.h-10")).toBeNull();
    // Ingresos en la misma `Tarjeta` oscura que el panel de la dueña.
    const placas = screen.getAllByText("Ingresos").map((e) => e.parentElement!.className);
    expect(placas.some((c) => c.includes("bg-slate-900") && c.includes("rounded-2xl border"))).toBe(true);
  });

  it("una cita futura no lleva 'Por cerrar' ni acción principal en la fila", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ ...emptyPage, datos: [citaEmpleado("Confirmada", 3_600_000)], total: 1 });
    renderConQuery();
    await screen.findByRole("button", { name: /Ana López, Corte\. Ver acciones/ });
    expect(screen.queryByText("Por cerrar")).toBeNull();
    // La "Próxima cita" sí trae Completar; la fila de la agenda no.
    const agenda = screen.getByRole("heading", { name: "Agenda de hoy" }).parentElement!.parentElement!;
    expect(within(agenda).queryByRole("button", { name: "Completar cita de Ana López" })).toBeNull();
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
    // El período activo se rellena con bg-slate-700, igual que los atajos de
    // período de FiltroRangoFechas y que las pills activas del dashboard.
    expect(btn14d).toHaveAttribute("aria-pressed", "true");
    expect(btn14d.className).toContain("bg-slate-700");

    const btn7d = screen.getByRole("button", { name: "7d" });
    expect(btn7d).toHaveAttribute("aria-pressed", "false");
    expect(btn7d.className).not.toContain("bg-slate-700");
  });
});
