import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GanttCitas from "./GanttCitas";
import { formatHoraEje } from "../../utils/formatters";

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
vi.mock("../../api/negocios", () => ({
  negociosApi: {
    // Lunes a sábado de 9:00 a 20:00; domingo cerrado.
    obtenerHorarios: vi.fn().mockResolvedValue(Array.from({ length: 7 }, (_, dia) => ({
      diaSemana: dia, activo: dia !== 0, intervalos: dia === 0 ? [] : [{ horaInicio: "09:00", horaFin: "20:00" }],
    }))),
    obtenerDiasBloqueados: vi.fn().mockResolvedValue([]),
  },
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

describe("GanttCitas — lote 4: agenda operable", () => {
  const ANA = { id: "e1", nombre: "Ana López", activo: true, email: "ana@test.com", servicioIds: [] };
  const BETO = { id: "e2", nombre: "Beto Ruiz", activo: true, email: "beto@test.com", servicioIds: [] };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2030, 0, 7, 12, 10)); // lunes
    const { empleadosApi } = await import("../../api/empleados");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([ANA, BETO] as any);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 200 });
  });
  afterEach(() => vi.useRealTimers());

  function renderizarCon(props: Partial<React.ComponentProps<typeof GanttCitas>> = {}) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onHuecoClick = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <GanttCitas onCitaClick={vi.fn()} onHuecoClick={onHuecoClick} {...props} />
      </QueryClientProvider>,
    );
    return { onHuecoClick };
  }
  // 56px por hora desde las 9:00 (apertura).
  const yDe = (h: number, m = 0) => (h - 9 + m / 60) * 56 + 1;
  // Con el horario cargado la rejilla empieza a las 9, no a las 7 por defecto.
  const horarioCargado = () => vi.waitFor(() => expect(screen.queryByText(formatHoraEje(7))).toBeNull());

  it("un hueco en la columna de un empleado abre Nueva cita con él, la fecha y la hora (I1)", async () => {
    const { onHuecoClick } = renderizarCon();
    await screen.findByText("Beto Ruiz");
    // Sin citas, igual se ven las columnas de todos: hacen falta para agendar.
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    await horarioCargado();
    fireEvent.click(screen.getByTestId("columna-e2"), { clientY: yDe(15, 40) });
    expect(onHuecoClick).toHaveBeenCalledWith({ inicio: new Date(2030, 0, 7, 15, 30), empleadoId: "e2" });
  });

  it("un hueco que ya pasó no abre nada", async () => {
    const { onHuecoClick } = renderizarCon();
    await screen.findByText("Beto Ruiz");
    await horarioCargado();
    fireEvent.click(screen.getByTestId("columna-e1"), { clientY: yDe(10) });
    expect(onHuecoClick).not.toHaveBeenCalled();
  });

  it("el filtro de empleado de la página deja solo su columna (I3)", async () => {
    renderizarCon({ empleadoId: "e1" });
    await screen.findByText("Ana López");
    expect(screen.queryByText("Beto Ruiz")).toBeNull();
  });

  it("la barra compartida mueve el día y consulta esa fecha (I3)", async () => {
    const onCambiarFecha = vi.fn();
    renderizarCon({ onCambiarFecha });
    expect(screen.getByText("Lun, 7 de ene 2030")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Día siguiente" }));
    expect(onCambiarFecha).toHaveBeenLastCalledWith("2030-01-08");
    expect(screen.getByText("Mar, 8 de ene 2030")).toBeInTheDocument();
    await vi.waitFor(() => expect(citasApi.obtenerTodas).toHaveBeenCalledWith({ desde: "2030-01-08", hasta: "2030-01-08", tamano: 200 }));
    // "Hoy" ya no se deshabilita: es el mismo botón que en el Calendario.
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(onCambiarFecha).toHaveBeenLastCalledWith("2030-01-07");
    expect(screen.getByRole("list", { name: "Leyenda de estados" })).toBeInTheDocument();
  });

  it("dos citas encimadas del mismo empleado quedan lado a lado", async () => {
    const d = new Date(2030, 0, 7, 16, 0).toISOString();
    const base = { codigoConfirmacion: "x", clienteId: "c", empleadoId: "e1", servicioId: "s", telefonoCliente: "55",
      nombreEmpleado: "Ana", nombreServicio: "Corte", duracionMinutos: 60, precio: 1, pagada: false, inicioEn: d, finEn: d,
      estado: 2, estadoTexto: "Confirmada" };
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
      datos: [{ ...base, id: "a", nombreCliente: "Uno" }, { ...base, id: "b", nombreCliente: "Dos" }],
      total: 2, pagina: 1, tamano: 200,
    });
    renderizarCon();
    const uno = await screen.findByRole("button", { name: /^Uno,/ });
    const dos = screen.getByRole("button", { name: /^Dos,/ });
    expect(uno.style.left).not.toBe(dos.style.left);
    expect(uno.style.width).toContain("50%");
  });
});

describe("GanttCitas — sondeo fallido con datos", () => {
  it("conserva la jornada pintada y avisa con un banner que no bloquea", async () => {
    const { empleadosApi } = await import("../../api/empleados");
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id: "e1", nombre: "Ana López", activo: true, email: "ana@test.com", servicioIds: [] } as any,
    ]);
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 200 });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <GanttCitas onCitaClick={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Ana López")).toBeInTheDocument();

    vi.mocked(citasApi.obtenerTodas).mockRejectedValue(new Error("red"));
    await qc.refetchQueries({ queryKey: ["citas-gantt"] });

    expect(await screen.findByText(/No se pudo actualizar la jornada/)).toBeInTheDocument();
    expect(screen.getByText("Ana López")).toBeInTheDocument();
    expect(screen.queryByText("No se pudo cargar la jornada.")).toBeNull();

    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await vi.waitFor(() => expect(screen.queryByText(/No se pudo actualizar la jornada/)).toBeNull());
  });
});
