import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    <QueryClientProvider client={qc}>
      <CancelarCitaPage />
    </QueryClientProvider>
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
