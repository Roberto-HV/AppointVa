import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
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
    obtenerNegocio: vi.fn(),
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
  default: ({ diasAnticipacionMinima }: { diasAnticipacionMinima?: number }) => (
    <div data-testid="paso-fecha-hora" data-dias-minimos={String(diasAnticipacionMinima)} />
  ),
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
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ConfirmacionPage />
      </QueryClientProvider>
    </MemoryRouter>
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

    // La página tiene dos controles de copiado con el mismo texto visible
    // ("Copiar enlace"): el del banner copia la URL actual y el del comprobante
    // copia el enlace corto de la cita. Se distinguen por su aria-label.
    const botonCopiar = screen.getByRole("button", {
      name: "Copiar enlace de esta página",
    });
    fireEvent.click(botonCopiar);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      window.location.href
    );

    await waitFor(() =>
      expect(screen.getByText(/¡copiado!/i)).toBeInTheDocument()
    );
  });

  it("los dos botones de copiado tienen nombres accesibles distintos y copian enlaces distintos", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase,
      emailCliente: undefined,
    } as never);

    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText(/sin correo registrado/i)).toBeInTheDocument()
    );

    const botonBanner = screen.getByRole("button", {
      name: "Copiar enlace de esta página",
    });
    const botonComprobante = screen.getByRole("button", {
      name: "Copiar enlace de la cita",
    });
    expect(botonBanner).not.toBe(botonComprobante);

    fireEvent.click(botonComprobante);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/cita/ABC123`
    );
  });

  it("si el portapapeles falla muestra el enlace para copiarlo a mano (BF-27)", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error("denegado"));
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: undefined } as never);
    renderConQuery();

    fireEvent.click(await screen.findByRole("button", { name: "Copiar enlace de la cita" }));

    const campo = await screen.findByLabelText(/No se pudo copiar/);
    expect(campo).toHaveValue(`${window.location.origin}/cita/ABC123`);
    expect(campo).toHaveAttribute("readonly");
    expect(screen.queryByText("¡Enlace copiado!")).not.toBeInTheDocument();
  });

  it("el título de la pestaña nombra al negocio con el formato común", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    renderConQuery();
    await waitFor(() => expect(document.title).toBe("Tu cita en Salón Test · AppointVa"));
  });

  it("usa el término del sector para quien atiende (BF-25)", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({ sector: "salud" } as never);
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    renderConQuery();
    expect(await screen.findByText("Profesional")).toBeInTheDocument();
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

// ── BF-04: el encabezado y el «¿Qué sigue?» reflejan el estado real ───────────
describe("ConfirmacionPage — estado de la cita", () => {
  async function renderCita(cambios: Record<string, unknown>) {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase,
      emailCliente: "juan@test.com",
      ...cambios,
    } as never);
    renderConQuery();
    return screen.findByRole("heading", { level: 1 });
  }

  it("confirmada: dice «¡Cita confirmada!»", async () => {
    const titulo = await renderCita({ estadoTexto: "Confirmada" });
    expect(titulo).toHaveTextContent("¡Cita confirmada!");
    expect(screen.getByText("Cita confirmada")).toBeInTheDocument();
  });

  it("pendiente sin anticipo: no la da por confirmada", async () => {
    const titulo = await renderCita({ estadoTexto: "Pendiente", estado: 0 });
    expect(titulo).toHaveTextContent("¡Cita agendada!");
    expect(screen.getByText("Pendiente de confirmación del negocio")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de confirmación")).toBeInTheDocument();
    expect(screen.queryByText(/cita confirmada/i)).not.toBeInTheDocument();
  });

  it("pendiente con anticipo sin pagar: pide el anticipo", async () => {
    const titulo = await renderCita({ estadoTexto: "Pendiente", requiereAnticipo: true, montoAnticipo: 100 });
    expect(titulo).toHaveTextContent("¡Cita agendada!");
    expect(screen.getByText("Falta tu anticipo para confirmarla")).toBeInTheDocument();
    expect(screen.getByText("Falta tu anticipo")).toBeInTheDocument();
    expect(screen.queryByText(/cita confirmada/i)).not.toBeInTheDocument();
  });

  it("pendiente con comprobante enviado: espera la revisión del negocio", async () => {
    const titulo = await renderCita({
      estadoTexto: "Pendiente",
      requiereAnticipo: true,
      montoAnticipo: 100,
      comprobanteUrl: "https://cdn.test/comprobante.jpg",
    });
    expect(titulo).toHaveTextContent("¡Cita agendada!");
    expect(screen.getByText("El negocio revisará tu pago y confirmará tu cita")).toBeInTheDocument();
    expect(screen.queryByText("Falta tu anticipo")).not.toBeInTheDocument();
  });

  it("confirmada con anticipo: manda el estado del negocio", async () => {
    const titulo = await renderCita({ estadoTexto: "Confirmada", requiereAnticipo: true, montoAnticipo: 100 });
    expect(titulo).toHaveTextContent("¡Cita confirmada!");
  });

  it("cancelada: dice «Cita cancelada»", async () => {
    const titulo = await renderCita({ estadoTexto: "Cancelada" });
    expect(titulo).toHaveTextContent("Cita cancelada");
  });

  it("completada: dice «¡Servicio completado!»", async () => {
    const titulo = await renderCita({ estadoTexto: "Completada" });
    expect(titulo).toHaveTextContent("¡Servicio completado!");
  });

  it("promete recordatorio por correo solo cuando hay correo", async () => {
    await renderCita({ estadoTexto: "Confirmada" });
    expect(screen.getByText(/recordatorio por correo/i)).toBeInTheDocument();
  });

  it("sin correo no promete recordatorio por correo", async () => {
    await renderCita({ estadoTexto: "Confirmada", emailCliente: undefined });
    expect(screen.queryByText(/recordatorio por correo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/whatsapp o correo/i)).not.toBeInTheDocument();
  });
});

// ── BF-16: el estado usa los tokens semánticos ────────────────────────────────
describe("ConfirmacionPage — badge de estado", () => {
  it("confirmada usa los tokens de estado confirmado", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    renderConQuery();
    const badge = (await screen.findByText("Estado")).nextElementSibling;
    expect(badge).toHaveTextContent(/^Confirmada$/);
    expect(badge?.textContent).not.toMatch(/[✓⏳]/);
    expect(badge).toHaveClass("bg-status-confirmed-bg", "text-status-confirmed-fg");
  });

  it("pendiente usa los tokens de estado pendiente", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase, emailCliente: "juan@test.com", estadoTexto: "Pendiente", estado: 0,
    } as never);
    renderConQuery();
    const badge = (await screen.findByText("Estado")).nextElementSibling;
    expect(badge).toHaveTextContent(/^Pendiente$/);
    expect(badge).toHaveClass("bg-status-pending-bg", "text-status-pending-fg");
  });
});

// ── BF-17: guardar en el calendario es la acción principal ────────────────────
describe("ConfirmacionPage — acciones", () => {
  const conCalendario = {
    ...mockCitaBase,
    emailCliente: "juan@test.com",
    icalUrl: "https://api.test/cita.ics",
    googleCalUrl: "https://calendar.google.com/x",
  };

  it("muestra Apple y Google Calendar sin un paso intermedio, antes de WhatsApp", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue(conCalendario as never);
    renderConQuery();

    const apple = await screen.findByRole("link", { name: /Apple Calendar/ });
    const google = screen.getByRole("link", { name: /Google Calendar/ });
    const whatsapp = screen.getByRole("link", { name: /Compartir por WhatsApp/ });
    expect(apple).toHaveAttribute("href", "https://api.test/cita.ics");
    expect(google).toHaveAttribute("href", "https://calendar.google.com/x");
    expect(apple.compareDocumentPosition(whatsapp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Reagendar y Cancelar son botones de 44px", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue(conCalendario as never);
    renderConQuery();

    expect(await screen.findByRole("button", { name: "Reagendar" })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: "Cancelar cita" })).toHaveClass("min-h-[44px]");
  });
});

// ── BF-19: reagendar respeta la anticipación mínima ───────────────────────────
describe("ConfirmacionPage — reagendar", () => {
  it("pasa la anticipación mínima al selector y muestra la política de cancelación", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase, emailCliente: "juan@test.com", diasAnticipacionMinima: 2, horasCancelacion: 24,
    } as never);
    renderConQuery();

    fireEvent.click(await screen.findByRole("button", { name: "Reagendar" }));

    expect(screen.getByTestId("paso-fecha-hora")).toHaveAttribute("data-dias-minimos", "2");
    expect(screen.getByText(/Cancelación gratuita hasta/)).toHaveTextContent("Cancelación gratuita hasta 24 horas antes de la cita.");
  });
});

// ── BF-18: carga y errores con salida ─────────────────────────────────────────
describe("ConfirmacionPage — carga y errores", () => {
  it("anuncia la carga", () => {
    vi.mocked(publicoApi.obtenerCita).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando tu cita…");
  });

  it("un 404 dice que la cita no existe y no reintenta", async () => {
    vi.mocked(publicoApi.obtenerCita).mockRejectedValue({ response: { status: 404 } });
    renderConQuery();

    expect(await screen.findByRole("heading", { name: "Cita no encontrada" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver mis citas" })).toHaveAttribute("href", "/b/salon-test/mis-citas");
    expect(publicoApi.obtenerCita).toHaveBeenCalledTimes(1);
  });

  it("un fallo de red no dice «no encontrada» y ofrece reintentar", async () => {
    vi.mocked(publicoApi.obtenerCita).mockRejectedValue(new Error("Network Error"));
    renderConQuery();

    expect(await screen.findByRole("heading", { name: "No pudimos cargar tu cita" })).toBeInTheDocument();
    expect(screen.queryByText("Cita no encontrada")).not.toBeInTheDocument();

    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText("ABC123")).toBeInTheDocument();
  });
});
