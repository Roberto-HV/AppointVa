import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ListaEsperaPage from "./ListaEsperaPage";
import { listaEsperaApi } from "../../api/listaEspera";
import type { EntradaListaEspera } from "../../api/listaEspera";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../api/listaEspera", () => ({
  listaEsperaApi: {
    obtener: vi.fn(),
    cambiarEstado: vi.fn(),
    eliminar: vi.fn(),
  },
  // keep the public API in scope so the import doesn't blow up
  listaEsperaPublicoApi: {
    unirse: vi.fn(),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerPerfil: vi.fn().mockResolvedValue({ nombre: "Salón Luna", slug: "salon-luna" }),
  },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: mockToast }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeEntrada = (overrides: Partial<EntradaListaEspera> = {}): EntradaListaEspera => ({
  id: "ent-1",
  nombreCliente: "Ana García",
  telefonoCliente: "555-1234",
  estado: "Esperando",
  fechaCreacion: "2024-01-01T10:00:00Z",
  ...overrides,
});

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ListaEsperaPage />
    </QueryClientProvider>
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listaEsperaApi.obtener).mockResolvedValue([]);
  vi.mocked(listaEsperaApi.cambiarEstado).mockResolvedValue({} as never);
  vi.mocked(listaEsperaApi.eliminar).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ListaEsperaPage — estado vacío", () => {
  it("muestra el mensaje cuando no hay entradas", async () => {
    renderConQuery();
    await screen.findByText("No hay entradas en la lista de espera");
  });
});

describe("ListaEsperaPage — entrada en lista", () => {
  it("muestra nombre, teléfono y servicio de la entrada", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ nombreCliente: "Ana García", telefonoCliente: "555-1234", servicioNombre: "Corte" }),
    ]);
    renderConQuery();
    await screen.findByText("Ana García");
    expect(screen.getByText("555-1234")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
  });
});

describe("ListaEsperaPage — filtro de estado", () => {
  it("el desplegable refleja el estado elegido", async () => {
    renderConQuery();
    // wait for page to settle (empty state renders)
    await screen.findByText("No hay entradas en la lista de espera");
    // El estado es un <Select>: las opciones solo existen con el panel abierto.
    const disparador = screen.getByRole("button", { name: "Estado" });
    fireEvent.click(disparador);
    fireEvent.click(screen.getByRole("option", { name: "Esperando" }));
    expect(disparador).toHaveTextContent("Esperando");
  });
});

describe("ListaEsperaPage — visibilidad de acciones", () => {
  it("muestra 'Marcar como avisado' cuando estado es Esperando", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ estado: "Esperando", telefonoCliente: "" }),
    ]);
    renderConQuery();
    await screen.findByRole("button", { name: /Marcar como avisado/ });
  });

  it("no muestra 'Marcar como avisado' cuando estado es Notificado", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ estado: "Notificado" }),
    ]);
    renderConQuery();
    // wait for the card to render (Confirmar is present for Notificado)
    await screen.findByTitle("Marcar como confirmado");
    expect(screen.queryByRole("button", { name: /Marcar como avisado/ })).not.toBeInTheDocument();
  });

  it("muestra 'Confirmar' cuando estado es Notificado", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ estado: "Notificado" }),
    ]);
    renderConQuery();
    await screen.findByTitle("Marcar como confirmado");
  });
});

describe("ListaEsperaPage — cambio de estado", () => {
  it("llama a cambiarEstado con 'Notificado' al hacer clic en 'Marcar como avisado'", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ id: "ent-1", estado: "Esperando", telefonoCliente: "" }),
    ]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Marcar como avisado/ }));
    await waitFor(() => {
      expect(listaEsperaApi.cambiarEstado).toHaveBeenCalledWith("ent-1", "Notificado");
    });
  });
});

describe("ListaEsperaPage — eliminar entrada", () => {
  it("llama a eliminar cuando el usuario confirma", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ id: "ent-1" }),
    ]);
    renderConQuery();
    fireEvent.click(await screen.findByTitle("Eliminar"));
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar entrada" }));
    await waitFor(() => {
      expect(listaEsperaApi.eliminar).toHaveBeenCalledWith("ent-1");
    });
  });

  it("no llama a eliminar cuando el usuario cancela", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ id: "ent-1" }),
    ]);
    renderConQuery();
    fireEvent.click(await screen.findByTitle("Eliminar"));
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));
    await waitFor(() => {
      expect(listaEsperaApi.eliminar).not.toHaveBeenCalled();
    });
  });
});

describe("ListaEsperaPage — avisar por WhatsApp (OM-06, decisión 6)", () => {
  it("con teléfono abre WhatsApp con negocio, servicio y fecha, y registra 'Avisado'", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({
        estado: "Esperando", telefonoCliente: "55 1234 5678", servicioNombre: "Corte",
        fechaPreferida: "2026-11-03T16:30:00",
      }),
    ]);
    renderConQuery();
    const enlace = await screen.findByRole("link", { name: /Avisar por WhatsApp/ });
    await waitFor(() => expect(decodeURIComponent(enlace.getAttribute("href")!)).toContain("Salón Luna"));
    const href = enlace.getAttribute("href")!;
    expect(href).toMatch(/^https:\/\/wa\.me\/525512345678\?text=/);
    const texto = decodeURIComponent(href.split("?text=")[1]);
    expect(texto).toContain("Hola Ana");
    expect(texto).toContain("*Corte*");
    expect(texto).toMatch(/03 nov/i);
    expect(texto).toContain("/b/salon-luna");
    expect(screen.queryByRole("button", { name: /Marcar como avisado/ })).not.toBeInTheDocument();

    fireEvent.click(enlace);
    await waitFor(() => expect(listaEsperaApi.cambiarEstado).toHaveBeenCalledWith("ent-1", "Notificado"));
  });

  it("sin teléfono solo ofrece 'Marcar como avisado', que no envía mensajes", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([makeEntrada({ estado: "Esperando", telefonoCliente: "" })]);
    renderConQuery();
    const boton = await screen.findByRole("button", { name: /Marcar como avisado/ });
    expect(boton).toHaveAttribute("title", expect.stringContaining("No envía ningún mensaje"));
    expect(screen.queryByRole("link", { name: /Avisar por WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Notificar$/ })).not.toBeInTheDocument();
  });
});

describe("ListaEsperaPage — expirar y estados vacíos (OM-31)", () => {
  it("expirar a alguien en espera ofrece 'Deshacer' que lo devuelve a Esperando", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([makeEntrada({ estado: "Esperando" })]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Marcar a Ana García como expirado" }));
    await waitFor(() => expect(listaEsperaApi.cambiarEstado).toHaveBeenCalledWith("ent-1", "Expirado"));
    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        "Ana García quedó como expirada", "exito", expect.objectContaining({ accion: expect.objectContaining({ etiqueta: "Deshacer" }) }),
      ),
    );
    const { accion } = mockToast.mock.calls.at(-1)![2];
    accion.onClick();
    await waitFor(() => expect(listaEsperaApi.cambiarEstado).toHaveBeenLastCalledWith("ent-1", "Esperando"));
  });

  it("expirar a alguien ya avisado pide confirmación y no ofrece deshacer", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([makeEntrada({ estado: "Notificado" })]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Marcar a Ana García como expirado" }));
    expect(listaEsperaApi.cambiarEstado).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como expirado" }));
    await waitFor(() => expect(listaEsperaApi.cambiarEstado).toHaveBeenCalledWith("ent-1", "Expirado"));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith("Estado actualizado"));
  });

  it("con un filtro activo el vacío nombra el estado", async () => {
    vi.mocked(listaEsperaApi.obtener).mockImplementation(async (estado?: string) =>
      estado ? [] : [makeEntrada({ estado: "Esperando" })]);
    renderConQuery();
    await screen.findByText("Ana García");
    fireEvent.click(screen.getByRole("button", { name: "Estado" }));
    fireEvent.click(screen.getByRole("option", { name: "Confirmado" }));
    expect(await screen.findByText('Ningún registro con estado "Confirmado"')).toBeInTheDocument();
  });

  it("un fallo de carga ofrece reintentar", async () => {
    vi.mocked(listaEsperaApi.obtener).mockRejectedValue(new Error("red"));
    renderConQuery();
    expect(await screen.findByText("No se pudo cargar la lista de espera.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
