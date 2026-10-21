import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GanttCitas from "./GanttCitas";

vi.mock("../../api/citas", () => ({ citasApi: { obtenerTodas: vi.fn() } }));
vi.mock("../../api/empleados", () => ({
  empleadosApi: { obtenerTodos: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../store/authStore", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (sel: (s: any) => unknown) => sel({ usuario: { rol: "Propietario", email: "o@test.com" } }),
}));
vi.mock("../ui/DateTimePicker", () => ({
  DatePicker: ({ value }: { value: string }) => <input readOnly value={value} aria-label="Fecha" />,
}));

import { citasApi } from "../../api/citas";

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GanttCitas onCitaClick={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("GanttCitas — error (DC-32)", () => {
  it("un fallo no se muestra como 'No hay empleados activos' y permite reintentar", async () => {
    vi.mocked(citasApi.obtenerTodas).mockRejectedValueOnce(new Error("red"));
    renderizar();
    expect(await screen.findByText("No se pudo cargar la jornada.")).toBeInTheDocument();
    expect(screen.queryByText("No hay empleados activos")).toBeNull();
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay empleados activos")).toBeInTheDocument();
  });

  it("la barra usa botones de 44px con nombre (DC-22)", async () => {
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 200 });
    renderizar();
    expect(screen.getByRole("button", { name: "Día anterior" }).className).toContain("min-h-[44px]");
    expect(screen.getByRole("button", { name: "Hoy" }).className).toContain("min-h-[44px]");
  });
});
