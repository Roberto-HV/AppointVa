import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConfirmacionPage from "./ConfirmacionPage";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ slug: "salon-test", codigo: "ABC123" }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../api/publico", () => ({
  publicoApi: {
    obtenerCita: vi.fn(),
    cancelarCita: vi.fn(),
    reagendarCita: vi.fn(),
  },
}));

vi.mock("../../api/comprobantes", () => ({
  comprobantesApi: { subirComprobante: vi.fn() },
}));

vi.mock("../../components/PublicFooter", () => ({
  default: () => <div data-testid="public-footer" />,
}));

vi.mock("../../lib/colorUtils", () => ({
  hexToChannels: () => "99 102 241",
  DEFAULT_COLOR: "#6366f1",
}));

vi.mock("../../components/icons/WhatsAppIcon", () => ({
  default: () => <svg data-testid="whatsapp-icon" />,
}));

vi.mock("../../components/icons/SocialLinks", () => ({
  default: () => <div data-testid="social-links" />,
}));

vi.mock("../../components/booking/PasoFechaHora", () => ({
  default: () => <div data-testid="paso-fecha-hora" />,
}));

vi.mock("../../utils/formatters", () => ({
  formatPrecio: (v: number) => `$${v}`,
  formatFechaHoraCompleta: () => "martes, 22 de julio de 2026 10:00",
}));

import { publicoApi } from "../../api/publico";

const mockCitaBase = {
  id: "cita-1",
  codigoConfirmacion: "ABC123",
  nombreNegocio: "Salón Test",
  negocioSlug: "salon-test",
  servicioId: "srv-1",
  empleadoId: "emp-1",
  nombreServicio: "Corte de cabello",
  nombreEmpleado: "Ana García",
  nombreCliente: "Juan Pérez",
  telefonoCliente: "5511223344",
  inicioEn: new Date(Date.now() + 86400000 * 2).toISOString(),
  finEn: new Date(Date.now() + 86400000 * 2 + 1800000).toISOString(),
  precio: 150,
  estado: 1,
  estadoTexto: "Confirmada",
  horasCancelacion: 0,
  requiereAnticipo: false,
  montoAnticipo: 0,
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmacionPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("ConfirmacionPage — banner sin email", () => {
  it("no muestra el banner cuando emailCliente está presente", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase,
      emailCliente: "juan@test.com",
    } as never);

    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText("ABC123")).toBeInTheDocument()
    );

    expect(
      screen.queryByText(/sin correo registrado/i)
    ).not.toBeInTheDocument();
  });

  it("muestra el banner cuando emailCliente está ausente", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase,
      emailCliente: undefined,
    } as never);

    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText(/sin correo registrado/i)).toBeInTheDocument()
    );
  });

  it("el botón Copiar enlace llama a clipboard.writeText", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase,
      emailCliente: undefined,
    } as never);

    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText(/sin correo registrado/i)).toBeInTheDocument()
    );

    const botonCopiar = screen.getByRole("button", { name: "Copiar enlace" });
    fireEvent.click(botonCopiar);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      window.location.href
    );

    await waitFor(() =>
      expect(screen.getByText(/¡copiado!/i)).toBeInTheDocument()
    );
  });

  it("el enlace Ver mis citas apunta a /b/salon-test/mis-citas", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase,
      emailCliente: undefined,
    } as never);

    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText(/sin correo registrado/i)).toBeInTheDocument()
    );

    const enlace = screen.getByRole("link", { name: /ver mis citas/i });
    expect(enlace).toHaveAttribute("href", "/b/salon-test/mis-citas");
  });
});
