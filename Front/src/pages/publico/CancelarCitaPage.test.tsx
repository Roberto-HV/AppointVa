import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CancelarCitaPage from "./CancelarCitaPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ codigo: "ABC123" }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../api/axios", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../../api/axios";

const mockCita = {
  codigoConfirmacion: "ABC123",
  nombreNegocio: "Salón Test",
  nombreServicio: "Corte de cabello",
  nombreEmpleado: "Ana García",
  nombreCliente: "Juan Pérez",
  inicioEn: new Date(Date.now() + 86_400_000).toISOString(),
  precio: 150,
  estado: 1,
  estadoTexto: "Confirmada",
  horasCancelacion: 0,
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 } },
  });
  return render(
    <MemoryRouter initialEntries={["/cancelar/ABC123"]}>
      <QueryClientProvider client={qc}>
        <CancelarCitaPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CancelarCitaPage", () => {
  it("shows loading state while verifying the token", () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it("shows error when the cita is not found", async () => {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 404 } });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText(/Cita no encontrada/i)).toBeInTheDocument()
    );
  });

  it("shows appointment details after successful token verification", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCita });
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Salón Test")).toBeInTheDocument()
    );
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("shows confirmation step after entering email and clicking cancel button", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCita });
    renderConQuery();

    await waitFor(() => screen.getByText("Salón Test"));

    fireEvent.change(screen.getByPlaceholderText(/tucorreo@ejemplo\.com/i), {
      target: { value: "juan@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar mi cita/i }));

    expect(
      screen.getByText(/¿Confirmas que deseas cancelar esta cita?/i)
    ).toBeInTheDocument();
  });

  it("calls the cancellation API and shows success state", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCita });
    vi.mocked(api.delete).mockResolvedValue({ data: {} });
    renderConQuery();

    await waitFor(() => screen.getByText("Salón Test"));

    fireEvent.change(screen.getByPlaceholderText(/tucorreo@ejemplo\.com/i), {
      target: { value: "juan@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cancelar mi cita/i }));
    fireEvent.click(screen.getByRole("button", { name: /Sí, cancelar/i }));

    await waitFor(() =>
      expect(screen.getByText(/Cita cancelada/i)).toBeInTheDocument()
    );
    expect(vi.mocked(api.delete)).toHaveBeenCalledWith(
      expect.stringContaining("ABC123"),
      expect.objectContaining({ params: { email: "juan@test.com" } })
    );
  });
});

describe("CancelarCitaPage — estados que no se pueden cancelar (AP-18)", () => {
  it("una cita completada (estado 3) no ofrece cancelar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...mockCita, estado: 3, negocioSlug: "salon-test" } });
    renderConQuery();
    expect(await screen.findByText("Esta cita ya se realizó")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar mi cita/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reservar una nueva cita" })).toHaveAttribute("href", "/b/salon-test");
  });

  it("una cita cancelada (estado 4) lo dice", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { ...mockCita, estado: 4 } });
    renderConQuery();
    expect(await screen.findByText("Esta cita ya está cancelada")).toBeInTheDocument();
  });

  it("una cita cuya hora ya pasó no ofrece cancelar", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockCita, estado: 2, inicioEn: new Date(Date.now() - 3_600_000).toISOString() },
    });
    renderConQuery();
    expect(await screen.findByText("Esta cita ya se realizó")).toBeInTheDocument();
  });

  it("ofrece reagendar antes de cancelar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCita });
    renderConQuery();
    expect(await screen.findByRole("link", { name: "Reagendar" })).toHaveAttribute("href", "/cita/ABC123");
  });

  it("un fallo de red no dice 'no encontrada' y permite reintentar", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Network Error")).mockResolvedValueOnce({ data: mockCita });
    renderConQuery();
    expect(await screen.findByText("No pudimos cargar tu cita")).toBeInTheDocument();
    expect(screen.queryByText(/Cita no encontrada/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Salón Test")).toBeInTheDocument();
  });
});
