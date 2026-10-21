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

  it("cada cita tiene una acción principal y los enlaces de calendario quedan en el detalle (AP-25)", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita, pastCita],
      headers: { "x-total-count": "2" },
    });
    renderConQuery();
    await waitFor(() => expect(screen.getByText("Próximas")).toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Ver cita" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Repetir" })).toHaveLength(2);
    expect(screen.queryByText("Google Calendar")).not.toBeInTheDocument();
    // El historial no ofrece reagendar ni cancelar (solo hay una cita próxima).
    expect(screen.getAllByRole("button", { name: "Reagendar" })).toHaveLength(1);
  });

  it("un fallo de red ofrece Reintentar en vez de culpar a los datos (AP-25)", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ data: [futureCita], headers: { "x-total-count": "1" } });
    renderConQuery();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No pudimos cargar tus citas");
    expect(alerta).not.toHaveTextContent(/Verifica tu información/);
    screen.getByRole("button", { name: "Reintentar" }).click();
    expect(await screen.findByText("Corte de cabello")).toBeInTheDocument();
  });

  it("un rechazo del servidor sigue ofreciendo corregir los datos", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockRejectedValue({ response: { status: 400, data: {} } });
    renderConQuery();
    expect(await screen.findByRole("button", { name: "Corregir mis datos" })).toBeInTheDocument();
  });

  it("muestra texto Reseña por correo solo en citas Completadas", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita, pastCita],
      headers: { "x-total-count": "2" },
    });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Reseña por correo")).toBeInTheDocument()
    );
    expect(screen.getAllByText("Reseña por correo")).toHaveLength(1);
  });

  it("sin correo explica por qué no hay Reagendar/Cancelar y cómo obtenerlos (AP-04)", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ telefono: "5511223344" }));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita],
      headers: { "x-total-count": "1" },
    });
    renderConQuery();
    await waitFor(() => expect(screen.getByText("Corte de cabello")).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.getByText(/busca tus citas con el correo que usaste al reservar/i)).toBeInTheDocument();
    expect(screen.getByText(/contacta directamente al negocio/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar con mi correo" })).toBeInTheDocument();
  });

  it("con correo muestra las acciones y no la explicación", async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(mockSession));
    vi.mocked(api.get).mockResolvedValue({
      data: [futureCita],
      headers: { "x-total-count": "1" },
    });
    renderConQuery();
    await waitFor(() => expect(screen.getByRole("button", { name: "Reagendar" })).toBeInTheDocument());
    expect(screen.queryByText(/busca tus citas con el correo/i)).not.toBeInTheDocument();
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
      screen.getByText(/no encontramos reservas con los datos proporcionados/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /nueva reserva/i })
    ).toBeInTheDocument();
  });
});
