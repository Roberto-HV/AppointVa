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

vi.mock("../../api/servicios", () => ({
  serviciosApi: { obtenerTodos: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../utils/exportarExcel", () => ({ exportarExcel: vi.fn() }));

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
    expect(screen.getByText("10:00")).toBeInTheDocument();
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
