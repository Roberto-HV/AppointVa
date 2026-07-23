import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MisCitasPage from "./MisCitasPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ slug: "salon-test" }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../api/axios", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("../../components/PublicFooter", () => ({
  default: () => <div data-testid="public-footer" />,
}));

vi.mock("../../components/booking/PasoFechaHora", () => ({
  default: () => <div data-testid="paso-fecha-hora" />,
}));

import { api } from "../../api/axios";

const SESSION_KEY = "mcs_session";
const mockSession = { email: "test@test.com", telefono: "5511223344" };

const futureCita = {
  id: "cita-1",
  codigoConfirmacion: "ABC123",
  nombreNegocio: "Salón Test",
  negocioSlug: "salon-test",
  nombreServicio: "Corte de cabello",
  nombreEmpleado: "María",
  servicioId: "serv-1",
  empleadoId: "emp-1",
  inicioEn: new Date(Date.now() + 86400000).toISOString(),
  finEn: new Date(Date.now() + 86400000 + 3600000).toISOString(),
  precio: 250,
  estado: 2,
  estadoTexto: "Confirmada",
};

const pastCita = {
  id: "cita-2",
  codigoConfirmacion: "XYZ789",
  nombreNegocio: "Salón Test",
  negocioSlug: "salon-test",
  nombreServicio: "Tinte",
  nombreEmpleado: "Ana",
  servicioId: "serv-2",
  empleadoId: "emp-2",
  inicioEn: new Date(Date.now() - 86400000).toISOString(),
  finEn: new Date(Date.now() - 86400000 + 3600000).toISOString(),
  precio: 500,
  estado: 3,
  estadoTexto: "Completada",
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <MisCitasPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.removeItem(SESSION_KEY);
});

describe("MisCitasPage", () => {
  it("muestra el formulario de acceso cuando no hay sesión", () => {
    renderConQuery();
    expect(screen.getByPlaceholderText("tu@correo.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10 dígitos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver mis citas/i })).toBeInTheDocument();
  });

  it("muestra el esqueleto de carga mientras la consulta está pendiente", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    await waitFor(() =>
      expect(container.querySelector(".animate-pulse")).toBeTruthy()
    );
  });

  it("muestra la sección Próximas con citas futuras confirmadas", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita, pastCita],
      headers: { "x-total-count": "2" },
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Próximas")).toBeInTheDocument()
    );
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
  });

  it("muestra la sección Historial con citas pasadas o completadas", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita, pastCita],
      headers: { "x-total-count": "2" },
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Historial")).toBeInTheDocument()
    );
    expect(screen.getByText("Tinte")).toBeInTheDocument();
  });

  it("muestra enlaces de calendario solo en citas próximas", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita, pastCita],
      headers: { "x-total-count": "2" },
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Google Calendar")).toBeInTheDocument()
    );
    expect(screen.getByText("iCal / Apple")).toBeInTheDocument();
    // Solo una cita próxima → exactamente un enlace de cada tipo
    expect(screen.getAllByText("Google Calendar")).toHaveLength(1);
    expect(screen.getAllByText("iCal / Apple")).toHaveLength(1);
  });

  it("muestra el botón Reseña → solo en citas Completadas", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita, pastCita],
      headers: { "x-total-count": "2" },
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText(/Reseña →/)).toBeInTheDocument()
    );
    expect(screen.getAllByText(/Reseña →/)).toHaveLength(1);
  });

  it("muestra el estado vacío cuando no hay citas", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [],
      headers: { "x-total-count": "0" },
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Sin citas registradas")).toBeInTheDocument()
    );
    expect(
      screen.getByText(/no encontramos reservas asociadas/i)
    ).toBeInTheDocument();
  });
});
