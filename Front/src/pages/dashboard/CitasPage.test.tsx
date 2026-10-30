import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { hoy } from "../../utils/fechas";
import CitasPage from "./CitasPage";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import type { CitaDto } from "../../types";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn(),
    obtenerPorId: vi.fn(),
    cambiarEstado: vi.fn(),
    reagendar: vi.fn(),
    marcarPagada: vi.fn(),
    crear: vi.fn(),
    actualizarNotas: vi.fn(),
    registrarAnticipo: vi.fn().mockResolvedValue({}),
  },
  ESTADOS: {
    Pendiente: 1,
    Confirmada: 2,
    Completada: 3,
    Cancelada: 4,
    Inasistencia: 5,
  },
  METODOS_PAGO: ["Efectivo", "Tarjeta", "Transferencia"],
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerTodos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn().mockResolvedValue({ nombre: "Salón Test", moduloPagosHabilitado: false }),
  },
}));

vi.mock("../../api/intake", () => ({
  intakeApi: {
    getRespuestas: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/axios", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock("../../utils/exportarExcel", () => ({
  exportarExcel: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../components/ui/DateTimePicker", () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

vi.mock("../../components/dashboard/CalendarioCitas", () => ({
  default: () => <div data-testid="calendario-citas" />,
}));

vi.mock("../../components/dashboard/GanttCitas", () => ({
  default: () => <div data-testid="gantt-citas" />,
}));

vi.mock("../../components/booking/PasoFechaHora", () => ({
  default: () => <div data-testid="paso-fecha-hora" />,
}));

vi.mock("../../components/ui/EstadoBadge", () => ({
  default: ({ estado }: { estado: string }) => (
    <span data-testid="estado-badge">{estado}</span>
  ),
}));

vi.mock("../../components/ui/Tooltip", () => ({
  Tooltip: ({ children, text }: { children: React.ReactNode; text?: string }) => (
    <span title={text}>{children}</span>
  ),
}));

vi.mock("../../components/ui/Pagination", () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock("../../components/ui/Modal", () => ({
  default: ({
    abierto,
    titulo,
    children,
  }: {
    abierto: boolean;
    titulo: string;
    children?: React.ReactNode;
    onCerrar?: () => void;
    ancho?: string;
  }) =>
    abierto ? (
      <div role="dialog" aria-label={titulo}>
        {children}
      </div>
    ) : null,
}));

vi.mock("../../components/ui/Select", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <select {...(props as object)}>{children}</select>
  ),
}));

import { citasApi } from "../../api/citas";
import { empleadosApi } from "../../api/empleados";
import { serviciosApi } from "../../api/servicios";
import { api } from "../../api/axios";

const makeCita = (overrides = {}) => ({
  id: "cita-1",
  nombreCliente: "Juan Pérez",
  telefonoCliente: "5511223344",
  emailCliente: "juan@test.com",
  nombreServicio: "Corte de cabello",
  nombreEmpleado: "María García",
  servicioId: "svc-1",
  empleadoId: "emp-1",
  clienteId: "cli-1",
  inicioEn: "2026-07-23T10:00:00",
  finEn: "2026-07-23T10:30:00",
  duracionMinutos: 30,
  precio: 200,
  estado: 1,
  estadoTexto: "Pendiente",
  pagada: false,
  metodoPago: null,
  notas: null,
  comprobanteUrl: null,
  codigoConfirmacion: "ABC123",
  ...overrides,
});

function UbicacionActual() {
  const { search } = useLocation();
  return <output data-testid="ubicacion">{search}</output>;
}

function renderConQuery(entrada = "/dashboard/citas") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <QueryClientProvider client={qc}>
        <CitasPage />
        <UbicacionActual />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CitasPage — estado de carga", () => {
  it("muestra el skeleton de tabla mientras se cargan las citas", async () => {
    vi.mocked(citasApi.obtenerTodas).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    await waitFor(() =>
      expect(container.querySelector(".animate-pulse")).toBeTruthy()
    );
  });
});

describe("CitasPage — estado vacío", () => {
  it("muestra el estado vacío cuando no hay citas en el rango", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Nada agendado en estas fechas")).toBeInTheDocument()
    );
    // Una sola salida, con la voz del sector: crear la cita desde ahí mismo.
    fireEvent.click(screen.getByRole("button", { name: "Nueva cita" }));
    expect(await screen.findByRole("dialog", { name: "Nueva cita" })).toBeInTheDocument();
  });
});

describe("CitasPage — lista de citas", () => {
  it("muestra el nombre del cliente en la tabla", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    );
  });

  it("muestra el nombre del servicio en la tabla", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Corte de cabello")).toBeInTheDocument()
    );
  });

  it("muestra el badge del estado de la cita", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("estado-badge")).toBeInTheDocument()
    );
    expect(screen.getByTestId("estado-badge")).toHaveTextContent("Pendiente");
  });

  it("muestra el botón '+ Nueva cita' en el encabezado", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nueva cita" })
      ).toBeInTheDocument()
    );
  });
});

describe("CitasPage — filtros de estado", () => {
  // El estado es un <Select>; aquí está mockeado como <select> nativo, así que
  // el control expone `combobox` y sus `option` en vez de pills.
  it("ofrece los estados como opciones del desplegable", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await screen.findByRole("combobox", { name: "Estado" });
    expect(screen.getByRole("option", { name: "Pendiente" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Confirmada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Completada" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cancelada" })).toBeInTheDocument();
  });

  it("muestra estado vacío filtrado al filtrar por estado sin coincidencias", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    const selector = await screen.findByRole("combobox", { name: "Estado" });
    fireEvent.change(selector, { target: { value: "Pendiente" } });
    await waitFor(() =>
      expect(screen.getByText("Sin citas pendientes")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — botones de acción en filas", () => {
  it("muestra el botón Confirmar, con nombre accesible, para citas Pendientes", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Pendiente" })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    expect(
      await screen.findByRole("button", { name: "Confirmar cita de Juan Pérez" })
    ).toBeInTheDocument();
  });

  it("Reagendar está en la hoja de acciones de la fila, también en pantallas pequeñas", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Pendiente" })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    const acciones = await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" });
    // El botón no depende de `sm:` para existir: es el mismo a 375px.
    expect(acciones.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    fireEvent.click(acciones);
    expect(await screen.findByRole("button", { name: "Reagendar" })).toBeInTheDocument();
  });

  it("las demás acciones de la fila viven en la hoja con texto", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Confirmada", estado: 2 })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    expect(await screen.findByRole("button", { name: "Agregar nota interna" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repetir cita" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar inasistencia" })).toBeInTheDocument();
    // Los datos del cliente se editan y consultan en Clientes, no desde la cita.
    expect(screen.queryByRole("button", { name: /Editar datos del cliente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver historial/ })).not.toBeInTheDocument();
  });

  it("ordena la hoja: estado, gestión, comunicación, detalle y las destructivas al final", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Confirmada", estado: 2 })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    const grupo = await screen.findByRole("group", { name: "Acciones de la cita" });
    const nombres = Array.from(grupo.querySelectorAll("button, a")).map((el) => el.textContent?.trim());
    const pos = (t: string) => nombres.findIndex((n) => n?.startsWith(t));
    expect(pos("Marcar como completada")).toBe(0);
    expect(pos("Reagendar")).toBeLessThan(pos("Agregar nota interna"));
    expect(pos("Agregar nota interna")).toBeLessThan(pos("Repetir cita"));
    expect(pos("Repetir cita")).toBeLessThan(pos("Enviar recordatorio por WhatsApp"));
    expect(pos("Enviar recordatorio por WhatsApp")).toBeLessThan(pos("Ver detalle"));
    expect(pos("Ver detalle")).toBeLessThan(pos("Marcar inasistencia"));
    expect(pos("Cancelar cita")).toBe(nombres.length - 1);
  });
});

describe("CitasPage — la hoja de acciones sobrevive al cambio tabla/tarjetas", () => {
  // matchMedia controlable: `cambiarAMovil(true|false)` dispara "change" como lo
  // haría el navegador al rotar el teléfono o redimensionar por debajo de 640px.
  let movil = false;
  const oyentes = new Set<() => void>();
  const matchMediaOriginal = window.matchMedia;

  const cambiarAMovil = (valor: boolean) => {
    movil = valor;
    act(() => { oyentes.forEach((fn) => fn()); });
  };

  beforeEach(() => {
    oyentes.clear();
    window.matchMedia = ((query: string) => ({
      get matches() { return movil; },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: () => void) => { oyentes.add(fn); },
      removeEventListener: (_: string, fn: () => void) => { oyentes.delete(fn); },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Confirmada", estado: 2 })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
  });

  afterEach(() => {
    window.matchMedia = matchMediaOriginal;
  });

  it("tabla → tarjetas: conserva la hoja abierta y el motivo escrito", async () => {
    movil = false;
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar cita" }));
    const hoja = screen.getByRole("dialog", { name: "Cancelar cita" });
    fireEvent.change(within(hoja).getByRole("textbox"), { target: { value: "El cliente avisó" } });
    expect(screen.getByRole("table")).toBeInTheDocument();

    cambiarAMovil(true);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Cita de Juan Pérez" })).toBeInTheDocument();
    const hojaTrasCambio = screen.getByRole("dialog", { name: "Cancelar cita" });
    expect(within(hojaTrasCambio).getByRole("textbox")).toHaveValue("El cliente avisó");
  });

  it("tarjetas → tabla: conserva la vista Reagendar y la fecha elegida", async () => {
    movil = true;
    renderConQuery();
    await screen.findByRole("article", { name: "Cita de Juan Pérez" });
    fireEvent.click(screen.getByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reagendar" }));
    const hoja = screen.getByRole("dialog", { name: "Reagendar cita" });
    const fecha = hoja.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: "2026-12-01" } });

    cambiarAMovil(false);

    expect(screen.getByRole("table")).toBeInTheDocument();
    const hojaTrasCambio = screen.getByRole("dialog", { name: "Reagendar cita" });
    expect(hojaTrasCambio.querySelector('input[type="date"]')).toHaveValue("2026-12-01");
  });
});

describe("CitasPage — tabs de vista", () => {
  it("muestra el componente de calendario al cambiar a la vista Calendario", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Calendario" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Calendario" }));
    await waitFor(() =>
      expect(screen.getByTestId("calendario-citas")).toBeInTheDocument()
    );
  });

  it("muestra el Gantt al cambiar a la vista Línea de tiempo", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Línea de tiempo" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Línea de tiempo" }));
    await waitFor(() =>
      expect(screen.getByTestId("gantt-citas")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — input de búsqueda", () => {
  it("muestra el placeholder 'Nombre o teléfono...' en el input de búsqueda", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Nombre o teléfono...")
      ).toBeInTheDocument()
    );
  });

  it("actualiza el valor al escribir en el input de búsqueda", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    const input = await screen.findByPlaceholderText("Nombre o teléfono...");
    fireEvent.change(input, { target: { value: "Juan" } });
    expect(input).toHaveValue("Juan");
  });
});

describe("CitasPage — atajo 'Hoy'", () => {
  it("establece ambas fechas al día actual al hacer clic en 'Hoy'", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    const { container } = renderConQuery();

    // Cambiar a Semana para que al menos una fecha difiera de hoy
    const btnSemana = await screen.findByRole("button", { name: "Esta semana" });
    fireEvent.click(btnSemana);

    // Volver a Hoy
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));

    const d = new Date();
    const hoyStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dateInputs = container.querySelectorAll('input[type="date"]');
    expect(dateInputs[0]).toHaveValue(hoyStr);
    expect(dateInputs[1]).toHaveValue(hoyStr);
  });
});

describe("CitasPage — paginación", () => {
  it("renderiza el componente Pagination cuando la respuesta contiene citas", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita()],
      total: 150,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByTestId("pagination")).toBeInTheDocument()
    );
  });
});

describe("CitasPage — filtro por empleado", () => {
  it("muestra el dropdown con el término del sector en la vista de lista (DC-34)", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [],
      total: 0,
      pagina: 1,
      tamano: 15,
    });
    const { container } = renderConQuery();
    // Sin sector en el perfil se usa el vocabulario por defecto ("Empleado");
    // "Profesional" solo aparece en salud.
    await waitFor(() =>
      expect(screen.getAllByText("Empleado").length).toBeGreaterThan(0)
    );
    expect(screen.queryByText("Profesional")).not.toBeInTheDocument();
    expect(container.querySelector("select")).toBeInTheDocument();
  });
});


describe("anticipo badge y botón", () => {
  function renderWithCitas(citas: CitaDto[]) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: citas,
      total: citas.length,
      pagina: 1,
      tamano: 200,
    });
    return render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <CitasPage />
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  const baseCita = {
    id: "cita-anticipo",
    codigoConfirmacion: "ANT001",
    clienteId: "c1",
    empleadoId: "e1",
    servicioId: "s1",
    nombreCliente: "Luis Pérez",
    telefonoCliente: "555-0001",
    nombreEmpleado: "Ana Gómez",
    nombreServicio: "Corte",
    duracionMinutos: 30,
    precio: 200,
    pagada: false,
    estado: 2,
    estadoTexto: "Confirmada",
    inicioEn: new Date(Date.now() + 86400000).toISOString(),
    finEn: new Date(Date.now() + 86400000 + 1800000).toISOString(),
  };

  it("no muestra badge cuando anticipoRequerido es false", async () => {
    renderWithCitas([{ ...baseCita, anticipoRequerido: false }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    expect(screen.queryByText(/Anticipo/)).toBeNull();
  });

  // El badge ya no usa emoji: es un pill con borde e icono de lucide, igual que
  // EstadoBadge. El texto es "Anticipo" en ambos estados, así que lo que los
  // distingue es el color del borde (ámbar/esmeralda) y el icono.
  it("muestra badge ámbar con icono de billete cuando el anticipo está pendiente", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: false,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    const badge = screen.getByText("Anticipo");
    expect(badge.className).toContain("border-amber-400");
    expect(badge.className).not.toContain("border-emerald-400");
    expect(badge.querySelector("svg")?.getAttribute("class")).toContain("banknote");
  });

  it("muestra badge esmeralda con icono de check cuando el anticipo fue recibido", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: true,
      montoAnticipo: 50,
    }]);
    await waitFor(() => screen.getByText("Luis Pérez"));
    const badge = screen.getByText("Anticipo");
    expect(badge.className).toContain("border-emerald-400");
    expect(badge.className).not.toContain("border-amber-400");
    expect(badge.querySelector("svg")?.getAttribute("class")).toContain("check");
  });

  it("ofrece registrar el anticipo, con su monto, cuando está pendiente y no pagada", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: false,
      montoAnticipo: 50,
    }]);
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Luis Pérez" }));
    fireEvent.click(await screen.findByRole("button", { name: /Registrar anticipo de \$50/ }));
    await waitFor(() =>
      expect(citasApi.registrarAnticipo).toHaveBeenCalledWith("cita-anticipo", true)
    );
  });

  it("anular un anticipo pide confirmación con el monto antes de cambiarlo", async () => {
    renderWithCitas([{
      ...baseCita,
      anticipoRequerido: true,
      anticipoRecibido: true,
      montoAnticipo: 50,
    }]);
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Luis Pérez" }));
    fireEvent.click(await screen.findByRole("button", { name: "Anular anticipo" }));

    const confirmacion = await screen.findByRole("dialog", { name: "Anular anticipo" });
    expect(confirmacion).toHaveTextContent(/\$50/);
    expect(confirmacion).toHaveTextContent("Luis Pérez");
    expect(citasApi.registrarAnticipo).not.toHaveBeenCalled();

    fireEvent.click(within(confirmacion).getByRole("button", { name: "Anular anticipo" }));
    await waitFor(() =>
      expect(citasApi.registrarAnticipo).toHaveBeenCalledWith("cita-anticipo", false)
    );
  });

  // B1: registrar desde la hoja refresca todas las vistas y no se puede enviar dos veces.
  it("registrar el anticipo invalida calendario y Gantt, y queda deshabilitado mientras se envía", async () => {
    let resolver: (v: unknown) => void = () => {};
    vi.mocked(citasApi.registrarAnticipo).mockReturnValue(new Promise((r) => { resolver = r; }) as never);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidar = vi.spyOn(qc, "invalidateQueries");
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [{ ...baseCita, anticipoRequerido: true, anticipoRecibido: false, montoAnticipo: 50 }],
      total: 1, pagina: 1, tamano: 200,
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <CitasPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const abrirHoja = () => fireEvent.click(screen.getByRole("button", { name: "Acciones de la cita de Luis Pérez" }));
    await screen.findByRole("button", { name: "Acciones de la cita de Luis Pérez" });
    abrirHoja();
    fireEvent.click(await screen.findByRole("button", { name: /Registrar anticipo de \$50/ }));
    await waitFor(() => expect(citasApi.registrarAnticipo).toHaveBeenCalledTimes(1));

    // Con la petición en curso, la hoja reabierta muestra la acción deshabilitada.
    abrirHoja();
    const enCurso = await screen.findByRole("button", { name: "Registrando anticipo…" });
    expect(enCurso).toBeDisabled();
    fireEvent.click(enCurso);
    expect(citasApi.registrarAnticipo).toHaveBeenCalledTimes(1);

    resolver({});
    await waitFor(() => {
      const claves = invalidar.mock.calls.map(([f]) => (f as { queryKey?: unknown[] })?.queryKey?.[0]);
      expect(claves).toEqual(expect.arrayContaining(["citas", "citas-cal", "citas-gantt", "dashboard-resumen"]));
    });
  });
});

// A 375px la tabla medía 482px y las acciones de cada fila quedaban fuera de la
// pantalla. Por debajo de `sm` la lista se muestra como tarjetas.
describe("CitasPage — tarjetas en pantallas angostas", () => {
  const matchMediaOriginal = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: matchMediaOriginal });
  });

  it("muestra cada cita como tarjeta, sin tabla, con sus datos y acciones a la vista", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Pendiente" })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    renderConQuery();

    const tarjeta = await screen.findByRole("article", { name: "Cita de Juan Pérez" });
    expect(screen.queryByRole("table")).toBeNull();

    expect(within(tarjeta).getByText("Corte de cabello · María García")).toBeInTheDocument();
    expect(within(tarjeta).getByTestId("estado-badge")).toHaveTextContent("Pendiente");
    expect(within(tarjeta).getByText(/\$200/)).toBeInTheDocument();

    expect(within(tarjeta).getByRole("link", { name: "Enviar recordatorio por WhatsApp a Juan Pérez" })).toBeInTheDocument();
    expect(within(tarjeta).getByRole("button", { name: "Confirmar cita de Juan Pérez" })).toBeInTheDocument();
    const acciones = within(tarjeta).getByRole("button", { name: "Acciones de la cita de Juan Pérez" });
    // Objetivo táctil de 44px en el teléfono.
    expect(acciones.className).toContain("min-h-[44px]");
    expect(acciones.className).toContain("min-w-[44px]");

    fireEvent.click(acciones);
    expect(await screen.findByRole("button", { name: "Reagendar" })).toBeInTheDocument();
  });
});

describe("CitasPage — filtros en la URL (DC-16)", () => {
  const vacio = { datos: [], total: 0, pagina: 1, tamano: 15 };

  it("lee estado, período y página de la URL", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue(vacio);
    renderConQuery("/dashboard/citas?estado=Pendiente&desde=2026-10-01&hasta=2026-10-31&pagina=2");
    await waitFor(() =>
      expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 1, desde: "2026-10-01", hasta: "2026-10-31", pagina: 2 }),
      ),
    );
    expect(await screen.findByRole("combobox", { name: "Estado" })).toHaveValue("Pendiente");
  });

  it("al filtrar escribe el filtro en la URL y vuelve a la página 1", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue(vacio);
    renderConQuery("/dashboard/citas?pagina=3");
    fireEvent.change(await screen.findByRole("combobox", { name: "Estado" }), { target: { value: "Confirmada" } });
    await waitFor(() => expect(screen.getByTestId("ubicacion")).toHaveTextContent("estado=Confirmada"));
    expect(screen.getByTestId("ubicacion")).not.toHaveTextContent("pagina");
  });

  it("descarta fechas, página y empleado inválidos y los quita de la URL", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue(vacio);
    renderConQuery("/dashboard/citas?desde=ayer&hasta=2026-02-31&pagina=1e308&empleadoId=abc&estado=Pendiente");
    await waitFor(() =>
      expect(citasApi.obtenerTodas).toHaveBeenCalledWith(
        expect.objectContaining({ desde: hoy(), hasta: hoy(), pagina: 1, empleadoId: undefined }),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("ubicacion")).toHaveTextContent(/^\?estado=Pendiente$/));
  });

  it("una página mayor que el total se lleva a la última", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [makeCita()], total: 20, pagina: 40, tamano: 15 });
    renderConQuery("/dashboard/citas?pagina=40");
    await waitFor(() => expect(screen.getByTestId("ubicacion")).toHaveTextContent("pagina=2"));
    await waitFor(() => expect(citasApi.obtenerTodas).toHaveBeenCalledWith(expect.objectContaining({ pagina: 2 })));
  });

  it("ignora un estado desconocido en la URL", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue(vacio);
    renderConQuery("/dashboard/citas?estado=Borrada");
    await waitFor(() => expect(citasApi.obtenerTodas).toHaveBeenCalledWith(expect.objectContaining({ estado: undefined })));
  });
});

describe("CitasPage — error al cargar (DC-32)", () => {
  it("un fallo no se lee como 'no hay citas' y ofrece reintentar", async () => {
    vi.mocked(citasApi.obtenerTodas).mockRejectedValueOnce(new Error("red"));
    renderConQuery();
    expect(await screen.findByText("No se pudieron cargar las citas.")).toBeInTheDocument();
    expect(screen.queryByText("Nada agendado en estas fechas")).toBeNull();
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [makeCita()], total: 1, pagina: 1, tamano: 15 });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Juan Pérez")).toBeInTheDocument();
  });
});

describe("CitasPage — eliminar una nota se puede deshacer (DC-33)", () => {
  it("borra sin confirmar y el aviso 'Deshacer' restaura el texto anterior", async () => {
    const { useToastStore } = await import("../../store/toastStore");
    act(() => useToastStore.setState({ toasts: [] }));
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ notas: "Alergia al tinte" })],
      total: 1,
      pagina: 1,
      tamano: 15,
    });
    vi.mocked(citasApi.actualizarNotas).mockResolvedValue({} as never);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ver o editar nota interna" }));
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar nota" }));
    await waitFor(() => expect(citasApi.actualizarNotas).toHaveBeenCalledWith("cita-1", null));

    const aviso = await waitFor(() => {
      const t = useToastStore.getState().toasts.find((x) => x.mensaje === "Nota eliminada");
      expect(t?.accion?.etiqueta).toBe("Deshacer");
      return t!;
    });
    act(() => useToastStore.getState().ejecutarAccion(aviso.id));
    await waitFor(() => expect(citasApi.actualizarNotas).toHaveBeenLastCalledWith("cita-1", "Alergia al tinte"));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((x) => x.mensaje === "Nota restaurada")).toBe(true),
    );
    act(() => useToastStore.setState({ toasts: [] }));
  });
});

describe("CitasPage — Empleado: rol restringido (DC-14, decisión 2)", () => {
  beforeEach(() => {
    useAuthStore.setState({ usuario: { id: "u-emp", email: "e@x.mx", nombreCompleto: "Emp", rol: "Empleado", negocioId: "n1" } });
  });
  afterEach(() => {
    useAuthStore.setState({ usuario: null });
  });

  it("no ve Exportar ni 'Editar datos del cliente', y no puede anular un anticipo", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Confirmada", estado: 2, anticipoRequerido: true, anticipoRecibido: true, montoAnticipo: 50 })],
      total: 1, pagina: 1, tamano: 15,
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    expect(await screen.findByRole("button", { name: "Agregar nota interna" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar datos del cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular anticipo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exportar Excel" })).not.toBeInTheDocument();
  });

  it("sí puede registrar el anticipo de su cita", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [makeCita({ estadoTexto: "Confirmada", estado: 2, anticipoRequerido: true, anticipoRecibido: false, montoAnticipo: 50 })],
      total: 1, pagina: 1, tamano: 15,
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" }));
    expect(await screen.findByRole("button", { name: /Registrar anticipo de/ })).toBeInTheDocument();
  });
});

describe("CitasPage — Confirmar seleccionadas (DC-30, decisión 14)", () => {
  const pendientes = () => [
    makeCita({ id: "c1", nombreCliente: "Ana Ruiz" }),
    makeCita({ id: "c2", nombreCliente: "Beto Soto" }),
    makeCita({ id: "c3", nombreCliente: "Carla Díaz" }),
    makeCita({ id: "c4", nombreCliente: "Dora Paz", estadoTexto: "Confirmada", estado: 2 }),
  ];

  afterEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("solo las Pendientes tienen casilla; la barra muestra el conteo", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: pendientes(), total: 4, pagina: 1, tamano: 15 });
    renderConQuery();
    const casilla = await screen.findByRole("checkbox", { name: "Seleccionar cita de Ana Ruiz" });
    expect(screen.queryByRole("checkbox", { name: "Seleccionar cita de Dora Paz" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Citas seleccionadas" })).not.toBeInTheDocument();
    fireEvent.click(casilla);
    const barra = screen.getByRole("region", { name: "Citas seleccionadas" });
    expect(barra).toHaveTextContent("1 seleccionada");
    fireEvent.click(screen.getByRole("checkbox", { name: /Seleccionar todas las citas pendientes/ }));
    expect(barra).toHaveTextContent("3 seleccionadas");
  });

  it("confirma una por una con el endpoint individual y resume el resultado con 'Reintentar'", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: pendientes(), total: 4, pagina: 1, tamano: 15 });
    vi.mocked(citasApi.cambiarEstado).mockImplementation(async (id) => {
      if (id === "c2") throw new Error("409");
      return {} as never;
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("checkbox", { name: /Seleccionar todas las citas pendientes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar seleccionadas" }));

    await waitFor(() => expect(citasApi.cambiarEstado).toHaveBeenCalledTimes(3));
    expect(vi.mocked(citasApi.cambiarEstado).mock.calls.map((c) => c[0])).toEqual(["c1", "c2", "c3"]);
    expect(citasApi.cambiarEstado).toHaveBeenCalledWith("c1", { nuevoEstado: 2 });

    await waitFor(() => {
      const t = useToastStore.getState().toasts.at(-1);
      expect(t?.mensaje).toBe("2 confirmadas, 1 falló");
      expect(t?.tipo).toBe("error");
      expect(t?.accion?.etiqueta).toBe("Reintentar");
    });
    // La que falló sigue seleccionada.
    expect(screen.getByRole("checkbox", { name: "Seleccionar cita de Beto Soto" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Seleccionar cita de Ana Ruiz" })).not.toBeChecked();

    vi.mocked(citasApi.cambiarEstado).mockResolvedValue({} as never);
    act(() => useToastStore.getState().toasts.at(-1)!.accion!.onClick());
    await waitFor(() => expect(vi.mocked(citasApi.cambiarEstado).mock.calls.at(-1)?.[0]).toBe("c2"));
    await waitFor(() => expect(useToastStore.getState().toasts.at(-1)?.mensaje).toBe("1 confirmada"));
  });

  it("'Reintentar' no lanza un segundo lote mientras otro sigue en curso", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: pendientes(), total: 4, pagina: 1, tamano: 15 });
    vi.mocked(citasApi.cambiarEstado).mockRejectedValue(new Error("409"));
    renderConQuery();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Seleccionar cita de Ana Ruiz" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar seleccionadas" }));
    await waitFor(() => expect(useToastStore.getState().toasts.at(-1)?.accion?.etiqueta).toBe("Reintentar"));
    const reintentar = useToastStore.getState().toasts.at(-1)!.accion!.onClick;

    // Un lote nuevo queda en curso (la llamada no responde todavía)…
    let responder: () => void = () => {};
    vi.mocked(citasApi.cambiarEstado).mockReset();
    vi.mocked(citasApi.cambiarEstado).mockImplementation(() => new Promise((r) => { responder = () => r({} as never); }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar seleccionadas" }));
    await screen.findByText(/Confirmando 0 de 1/);
    // …y el "Reintentar" del toast anterior no arranca otro en paralelo.
    act(() => reintentar());
    expect(citasApi.cambiarEstado).toHaveBeenCalledTimes(1);

    act(() => responder());
    await waitFor(() => expect(useToastStore.getState().toasts.at(-1)?.mensaje).toBe("1 confirmada"));
    expect(citasApi.cambiarEstado).toHaveBeenCalledTimes(1);
  });
});

describe("CitasPage — nueva cita: teléfono obligatorio", () => {
  // POST /citas rechaza el alta sin TelefonoCliente ([Required] en CrearCitaDto).
  async function llegarADatosDelCliente() {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 15 });
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([
      { id: "svc-1", nombre: "Corte", activo: true, duracionMinutos: 45, precio: 280 },
    ] as never);
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([
      { id: "emp-1", nombre: "Ana", activo: true, servicioIds: ["svc-1"] },
    ] as never);
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === "/publico/disponibilidad"
        ? { data: [{ inicio: "2030-01-10T10:00:00", horaTexto: "10:00" }] }
        : { data: [] }
    );
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nueva cita" }));
    const modal = await screen.findByRole("dialog", { name: "Nueva cita" });
    fireEvent.click(await within(modal).findByRole("button", { name: /Corte/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Ana" }));
    fireEvent.change(modal.querySelector('input[type="date"]')!, { target: { value: "2030-01-10" } });
    fireEvent.click(await within(modal).findByRole("button", { name: "10:00" }));
    fireEvent.click(within(modal).getByRole("button", { name: "Continuar" }));
    return modal;
  }

  it("marca el teléfono como obligatorio y no envía sin él", async () => {
    const modal = await llegarADatosDelCliente();
    const telefono = within(modal).getByLabelText(/Teléfono/);
    expect(telefono).toBeRequired();
    expect(modal.querySelector('label[for="nueva-telefono"]')).not.toHaveTextContent(/opcional/i);

    fireEvent.change(within(modal).getByLabelText(/Nombre del cliente/), { target: { value: "Luis" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Crear cita" }));

    expect(await within(modal).findByText("Ingresa el teléfono del cliente")).toBeInTheDocument();
    expect(telefono).toHaveAttribute("aria-invalid", "true");
    expect(citasApi.crear).not.toHaveBeenCalled();
  });

  it("con teléfono válido envía la cita", async () => {
    vi.mocked(citasApi.crear).mockResolvedValue({} as never);
    const modal = await llegarADatosDelCliente();
    fireEvent.change(within(modal).getByLabelText(/Nombre del cliente/), { target: { value: "Luis" } });
    fireEvent.change(within(modal).getByLabelText(/Teléfono/), { target: { value: "55 1122 3344" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Crear cita" }));
    await waitFor(() => expect(citasApi.crear).toHaveBeenCalledWith(
      expect.objectContaining({ telefonoCliente: "55 1122 3344" })
    ));
  });
});
