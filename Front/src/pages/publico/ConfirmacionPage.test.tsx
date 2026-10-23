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

// `real.cuando` deja pasar la implementación real de describirCuandoCita.
const real = vi.hoisted(() => ({ cuando: false }));

vi.mock("../../utils/formatters", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../utils/formatters")>();
  return {
    ...mod,
    formatPrecio: (v: number) => `$${v}`,
    formatFechaHoraCompleta: () => "martes, 22 de julio de 2026 10:00",
    describirCuandoCita: (iso: string, ahora?: Date) => {
      if (real.cuando) return mod.describirCuandoCita(iso, ahora);
      const r = mod.describirCuandoCita(iso, ahora);
      return r && { ...r, texto: "el miércoles 22 a las 10:00 a. m." };
    },
  };
});

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
  real.cuando = false;
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

// ── BF-04: el encabezado, el sello y el «¿Qué sigue?» reflejan el estado real ─
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

  it("el titular dice cuándo la esperan, en Inter (sin cara display)", async () => {
    const titulo = await renderCita({ estadoTexto: "Confirmada" });
    expect(titulo).toHaveTextContent("Te esperamos el miércoles 22 a las 10:00 a. m.");
    expect(titulo).not.toHaveClass("font-display");
  });

  it("si la hora ya pasó no dice «te esperamos»", async () => {
    const titulo = await renderCita({ estadoTexto: "Confirmada", inicioEn: new Date(Date.now() - 86400000 * 3).toISOString() });
    expect(titulo).toHaveTextContent(/^Tu cita fue /);
  });

  it("hoy y ya empezada (sin mocks de fecha): «Tu cita es hoy…»", async () => {
    real.cuando = true;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 21, 15, 0));
    try {
      const titulo = await renderCita({
        estadoTexto: "Confirmada",
        inicioEn: new Date(2026, 9, 21, 14, 0).toISOString(),
        finEn: new Date(2026, 9, 21, 15, 30).toISOString(),
      });
      expect(titulo).toHaveTextContent(/^Tu cita es hoy a las 2:00/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("inasistencia: no dice «Por confirmar» ni promete pendiente", async () => {
    await renderCita({ estadoTexto: "Inasistencia", estado: 5, inicioEn: new Date(Date.now() - 86400000).toISOString() });
    const sello = screen.getAllByText("Inasistencia").find((el) => el.classList.contains("bg-status-absent-bg"));
    expect(sello).toBeDefined();
    expect(screen.queryByText("Por confirmar")).not.toBeInTheDocument();
    expect(screen.queryByText(/pendiente de confirmación/i)).not.toBeInTheDocument();
    expect(screen.queryByText("¿Qué sigue?")).not.toBeInTheDocument();
    expect(screen.queryByText("Recordatorio")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Tu cita fue /);
  });

  it("confirmada: el sello dice «Confirmada»", async () => {
    await renderCita({ estadoTexto: "Confirmada" });
    expect(screen.getByText("Confirmada")).toHaveClass("bg-status-confirmed-bg");
    expect(screen.getByText("Cita confirmada")).toBeInTheDocument();
  });

  it("pendiente sin anticipo: no la da por confirmada", async () => {
    await renderCita({ estadoTexto: "Pendiente", estado: 0 });
    expect(screen.getByText("Por confirmar")).toHaveClass("bg-status-pending-bg");
    expect(screen.getByText("Pendiente de confirmación del negocio")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de confirmación")).toBeInTheDocument();
    expect(screen.queryByText(/cita confirmada/i)).not.toBeInTheDocument();
  });

  it("pendiente con anticipo sin pagar: pide el anticipo", async () => {
    await renderCita({ estadoTexto: "Pendiente", requiereAnticipo: true, montoAnticipo: 100 });
    expect(screen.getByText("Falta anticipo")).toBeInTheDocument();
    expect(screen.getByText("Falta tu anticipo para confirmarla")).toBeInTheDocument();
    expect(screen.getByText("Falta tu anticipo")).toBeInTheDocument();
    expect(screen.queryByText(/cita confirmada/i)).not.toBeInTheDocument();
  });

  it("pendiente con comprobante enviado: espera la revisión del negocio", async () => {
    await renderCita({
      estadoTexto: "Pendiente",
      requiereAnticipo: true,
      montoAnticipo: 100,
      comprobanteUrl: "https://cdn.test/comprobante.jpg",
    });
    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
    expect(screen.getByText("El negocio revisará tu pago y confirmará tu cita")).toBeInTheDocument();
    expect(screen.queryByText("Falta tu anticipo")).not.toBeInTheDocument();
  });

  it("confirmada con anticipo: manda el estado del negocio", async () => {
    await renderCita({ estadoTexto: "Confirmada", requiereAnticipo: true, montoAnticipo: 100 });
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(screen.queryByText("Falta anticipo")).not.toBeInTheDocument();
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

// ── BF-16: el sello usa los tokens semánticos y vive en el talón ──────────────
describe("ConfirmacionPage — sello de estado", () => {
  it("confirmada usa los tokens de estado confirmado", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    renderConQuery();
    const sello = await screen.findByText("Confirmada");
    expect(sello.textContent).not.toMatch(/[✓⏳]/);
    expect(sello).toHaveClass("bg-status-confirmed-bg", "text-status-confirmed-fg");
    // El lector de pantalla oye "Estado de la cita: Confirmada".
    expect(sello.parentElement).toHaveTextContent("Estado de la cita: Confirmada");
  });

  it("pendiente usa los tokens de estado pendiente", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...mockCitaBase, emailCliente: "juan@test.com", estadoTexto: "Pendiente", estado: 0,
    } as never);
    renderConQuery();
    const sello = await screen.findByText("Por confirmar");
    expect(sello).toHaveClass("bg-status-pending-bg", "text-status-pending-fg");
  });

  it("el código va en el talón, antes del borde perforado y del detalle", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    const { container } = renderConQuery();
    const codigo = await screen.findByText("ABC123");
    const perforado = container.querySelector(".talon-perforado")!;
    expect(perforado).toHaveAttribute("aria-hidden", "true");
    expect(codigo.compareDocumentPosition(perforado) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(perforado.compareDocumentPosition(screen.getByText("Juan Pérez")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("la banda del negocio usa su foto de portada y su logo", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      sector: "belleza", portadaUrl: "https://cdn.test/portada.jpg", logoUrl: "https://cdn.test/logo.png",
    } as never);
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com" } as never);
    const { container } = renderConQuery();
    await screen.findByText("ABC123");
    await waitFor(() =>
      expect(container.querySelector('[data-testid="banda-negocio"] img')).toHaveAttribute("src", "https://cdn.test/portada.jpg")
    );
    expect(container.querySelector('img[src="https://cdn.test/logo.png"]')).toBeInTheDocument();
  });

  it("con foto, la banda conserva el fondo del negocio; si la foto o el logo fallan, quedan el color y el monograma", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      sector: "belleza", portadaUrl: "https://cdn.test/portada.jpg", logoUrl: "https://cdn.test/logo.png",
    } as never);
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({ ...mockCitaBase, emailCliente: "juan@test.com", colorPrimario: "#2F7D4F" } as never);
    const { container } = renderConQuery();
    await screen.findByText("ABC123");
    const banda = container.querySelector('[data-testid="banda-negocio"]') as HTMLElement;
    await waitFor(() => expect(banda.querySelector("img")).not.toBeNull());
    expect(banda.style.background || banda.style.backgroundColor || banda.style.backgroundImage).not.toBe("");

    fireEvent.error(banda.querySelector("img")!);
    fireEvent.error(container.querySelector('img[src="https://cdn.test/logo.png"]')!);
    await waitFor(() => expect(banda.querySelector("img")).toBeNull());
    expect(container.querySelector('img[src="https://cdn.test/logo.png"]')).toBeNull();
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(banda.style.background || banda.style.backgroundColor || banda.style.backgroundImage).not.toBe("");
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

  it("calendario y WhatsApp van justo bajo el talón, antes de «¿Qué sigue?»", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue(conCalendario as never);
    renderConQuery();
    const whatsapp = await screen.findByRole("link", { name: /Compartir por WhatsApp/ });
    const queSigue = screen.getByText("¿Qué sigue?");
    expect(whatsapp.compareDocumentPosition(queSigue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("si falta el anticipo, su panel va antes que el calendario", async () => {
    vi.mocked(publicoApi.obtenerCita).mockResolvedValue({
      ...conCalendario, estadoTexto: "Pendiente", requiereAnticipo: true, montoAnticipo: 100,
    } as never);
    renderConQuery();
    const apple = await screen.findByRole("link", { name: /Apple Calendar/ });
    const anticipo = screen.getByText("Anticipo requerido");
    expect(anticipo.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
