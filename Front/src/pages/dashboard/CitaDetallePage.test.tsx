import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CitaDetallePage from "./CitaDetallePage";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ id: "cita-1" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerPorId: vi.fn(),
  },
  ESTADOS: {
    Pendiente: 1,
    Confirmada: 2,
    Completada: 3,
    Cancelada: 4,
    Inasistencia: 5,
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerPerfil: vi.fn().mockResolvedValue({ nombre: "Salón Test", sector: "belleza" }) },
}));

vi.mock("../../api/intake", () => ({
  intakeApi: { getRespuestas: vi.fn().mockResolvedValue([]) },
}));

import { citasApi } from "../../api/citas";

const mockCita = {
  id: "cita-1",
  codigoConfirmacion: "ABC123",
  nombreServicio: "Corte de cabello",
  nombreEmpleado: "María García",
  nombreCliente: "Juan Pérez",
  telefonoCliente: "5511223344",
  emailCliente: "juan@test.com",
  inicioEn: "2026-07-23T10:00:00",
  finEn: "2026-07-23T10:30:00",
  duracionMinutos: 30,
  precio: 200,
  estado: 2,
  estadoTexto: "Confirmada",
  pagada: false,
  metodoPago: null,
  notas: null,
};

function renderConQuery(entradas: string[] = ["/dashboard/citas/cita-1"]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
      <QueryClientProvider client={qc}>
        <CitaDetallePage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CitaDetallePage — estado de carga", () => {
  it("muestra un esqueleto mientras se obtiene la cita", async () => {
    vi.mocked(citasApi.obtenerPorId).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    await waitFor(() =>
      expect(container.querySelector(".animate-pulse")).toBeTruthy()
    );
  });
});

describe("CitaDetallePage — estado de error", () => {
  it("muestra mensaje de error cuando la cita no existe", async () => {
    vi.mocked(citasApi.obtenerPorId).mockRejectedValue(new Error("Not found"));
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByText("No se encontró la cita o no tienes acceso.")
      ).toBeInTheDocument()
    );
  });
});

describe("CitaDetallePage — datos de la cita", () => {
  it("muestra el nombre del servicio", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as any);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Corte de cabello")).toBeInTheDocument()
    );
  });

  it("muestra el nombre del empleado", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as any);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("con María García")).toBeInTheDocument()
    );
  });

  it("muestra el nombre del cliente", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as any);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Juan Pérez")).toBeInTheDocument()
    );
  });

  it("muestra el código de confirmación", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as any);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("ABC123")).toBeInTheDocument()
    );
  });

  it("muestra el badge del estado de la cita", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as any);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Confirmada")).toBeInTheDocument()
    );
  });

  it("muestra los botones para agregar al calendario", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as any);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Google Calendar")).toBeInTheDocument()
    );
    expect(screen.getByText("Guardar en calendario")).toBeInTheDocument();
  });
});

describe("CitaDetallePage — acciones", () => {
  it("ya no es un callejón sin salida: ofrece las acciones de la cita, incluido reagendar", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as never);
    renderConQuery();
    const acciones = await screen.findByRole("button", { name: "Acciones de la cita de Juan Pérez" });
    expect(screen.getByRole("button", { name: "Completar cita de Juan Pérez" })).toBeInTheDocument();
    fireEvent.click(acciones);
    expect(await screen.findByRole("button", { name: "Reagendar" })).toBeInTheDocument();
    // Desde el detalle no se ofrece volver al detalle.
    expect(screen.queryByRole("link", { name: "Ver detalle" })).toBeNull();
  });
});

describe("CitaDetallePage — volver (DC-16)", () => {
  it("con historial vuelve atrás, conservando los filtros de la lista", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as never);
    renderConQuery(["/dashboard/citas?estado=Pendiente&pagina=2", "/dashboard/citas/cita-1"]);
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it("si se llegó directo (notificación), abre la lista", async () => {
    vi.mocked(citasApi.obtenerPorId).mockResolvedValue(mockCita as never);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/citas");
  });
});
