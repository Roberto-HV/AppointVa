import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReportesPage from "./ReportesPage";

vi.mock("../../api/reportes", () => ({
  reportesApi: {
    obtenerCitas: vi.fn(),
    obtenerIngresos: vi.fn(),
    obtenerHeatmap: vi.fn(),
    obtenerRetencion: vi.fn(),
  },
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: { obtenerTodos: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerHorarios: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: { obtenerTodos: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../utils/exportarExcel", () => ({ exportarExcel: vi.fn(() => Promise.resolve()) }));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children?: any }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: any }) => <div>{children}</div>,
  Cell: () => null,
}));

import { reportesApi } from "../../api/reportes";
import { exportarExcel } from "../../utils/exportarExcel";
import { useToastStore } from "../../store/toastStore";

const mockHeatmap = {
  totalCitas: 42,
  horaPico: "10:00",
  diaPico: "Lunes",
  maximo: 8,
  matriz: Array.from({ length: 24 }, () => Array(7).fill(0)),
};

const mockRetencion = {
  totalClientes: 30,
  clientesNuevos: 12,
  clientesRecurrentes: 18,
  tasaRetencion: 60.0,
  ingresoMesActual: 15000,
  proyeccionMes: 20000,
  ingresoAgendado: 5000,
  diasRestantesMes: 10,
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ReportesPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(reportesApi.obtenerCitas).mockReturnValue(new Promise(() => {}));
  vi.mocked(reportesApi.obtenerIngresos).mockReturnValue(new Promise(() => {}));
  vi.mocked(reportesApi.obtenerHeatmap).mockReturnValue(new Promise(() => {}));
  vi.mocked(reportesApi.obtenerRetencion).mockReturnValue(new Promise(() => {}));
});

describe("ReportesPage — tab Horarios (heatmap)", () => {
  it("muestra el spinner mientras carga el heatmap", async () => {
    const { container } = renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeTruthy()
    );
  });

  it("muestra las tarjetas de resumen con datos del heatmap", async () => {
    vi.mocked(reportesApi.obtenerHeatmap).mockResolvedValue(mockHeatmap);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    await waitFor(() =>
      expect(screen.getByText("42")).toBeInTheDocument()
    );
    // "10:00" aparece en la tarjeta de hora pico y como fila del mapa.
    expect(screen.getAllByText("10:00").length).toBeGreaterThan(0);
    expect(screen.getByText("Lunes")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando totalCitas es 0", async () => {
    vi.mocked(reportesApi.obtenerHeatmap).mockResolvedValue({
      ...mockHeatmap,
      totalCitas: 0,
    });
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    await waitFor(() =>
      expect(
        screen.getByText("No hay citas en el rango seleccionado.")
      ).toBeInTheDocument()
    );
  });
});

describe("ReportesPage — tab Retención", () => {
  it("muestra el spinner mientras carga la retención", async () => {
    const { container } = renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Retención" }));
    await waitFor(() =>
      expect(container.querySelector(".animate-spin")).toBeTruthy()
    );
  });

  it("muestra las tarjetas con datos de retención", async () => {
    vi.mocked(reportesApi.obtenerRetencion).mockResolvedValue(mockRetencion);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Retención" }));
    await waitFor(() =>
      expect(screen.getByText("30")).toBeInTheDocument()
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando totalClientes es 0", async () => {
    vi.mocked(reportesApi.obtenerRetencion).mockResolvedValue({
      ...mockRetencion,
      totalClientes: 0,
    });
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Retención" }));
    await waitFor(() =>
      expect(
        screen.getByText("No hay datos de clientes en el rango seleccionado.")
      ).toBeInTheDocument()
    );
  });
});

describe("ReportesPage — errores con reintento (OM-20)", () => {
  it("un fallo del heatmap no se lee como 'sin citas' y se puede reintentar", async () => {
    vi.mocked(reportesApi.obtenerHeatmap).mockRejectedValueOnce(new Error("red"));
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    expect(await screen.findByText("No se pudo cargar la ocupación por horario.")).toBeInTheDocument();
    expect(screen.queryByText("No hay citas en el rango seleccionado.")).toBeNull();
    expect(screen.queryByText(/cambiar el rango/)).toBeNull();

    vi.mocked(reportesApi.obtenerHeatmap).mockResolvedValue(mockHeatmap);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("42")).toBeInTheDocument();
  });

  it("un fallo de retención ofrece reintentar", async () => {
    vi.mocked(reportesApi.obtenerRetencion).mockRejectedValueOnce(new Error("red"));
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Retención" }));
    expect(await screen.findByText("No se pudieron cargar los datos de retención.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("ReportesPage — mapa de calor (OM-18)", () => {
  it("solo pinta las horas de atención y trae leyenda", async () => {
    const { negociosApi } = await import("../../api/negocios");
    vi.mocked(negociosApi.obtenerHorarios).mockResolvedValue([
      { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "12:00" }] },
    ]);
    vi.mocked(reportesApi.obtenerHeatmap).mockResolvedValue(mockHeatmap);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    await waitFor(() => expect(screen.getAllByRole("rowheader")).toHaveLength(3));
    expect(screen.getAllByRole("rowheader").map((r) => r.textContent)).toEqual(["9:00", "10:00", "11:00"]);
    expect(screen.getByLabelText("Escala: de 0 a 8 citas")).toBeInTheDocument();
  });
});

describe("ReportesPage — exportar (OM-19)", () => {
  const reporte = {
    totalCitas: 1, totalCompletadas: 1, totalCanceladas: 0, totalPendientes: 0, totalInasistencias: 0,
    totalIngresos: 149.9, totalIngresosEfectivo: 0, totalIngresosTarjeta: 0,
    citas: [{
      id: "c1", codigoConfirmacion: "ABC", nombreCliente: "Ana", telefonoCliente: "55", nombreServicio: "Corte",
      nombreEmpleado: "Luis", inicioEn: "2026-10-01T16:00:00Z", duracionMinutos: 30, precio: 149.9, pagada: true,
      estado: 3, estadoTexto: "Completada",
    }],
  };

  it("escribe precio y fecha como celdas con tipo y el período en fecha local", async () => {
    vi.mocked(reportesApi.obtenerCitas).mockResolvedValue(reporte);
    renderConQuery();
    const boton = await screen.findByRole("button", { name: /Exportar Excel/ });
    await waitFor(() => expect(boton).not.toBeDisabled());
    fireEvent.click(boton);
    const [, filas, , , opciones] = vi.mocked(exportarExcel).mock.calls[0];
    const fila = filas[0][0];
    expect(fila[6]).toBeInstanceOf(Date);
    expect(fila[8]).toEqual({ moneda: 149.9 });
    expect(opciones?.subtitulo).toMatch(/^Período: 01 de \S+ de \d{4} — /);
  });

  it("avisa con un toast si el archivo no se pudo generar", async () => {
    useToastStore.setState({ toasts: [] });
    vi.mocked(exportarExcel).mockRejectedValueOnce(new Error("x"));
    vi.mocked(reportesApi.obtenerCitas).mockResolvedValue(reporte);
    renderConQuery();
    const boton = await screen.findByRole("button", { name: /Exportar Excel/ });
    await waitFor(() => expect(boton).not.toBeDisabled());
    fireEvent.click(boton);
    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.mensaje)).toContain(
        "No se pudo generar el archivo de Excel. Intenta de nuevo.",
      ),
    );
  });
});
