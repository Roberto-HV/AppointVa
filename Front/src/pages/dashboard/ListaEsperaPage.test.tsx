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
  it("el botón 'Esperando' adquiere estilo activo al hacer clic", async () => {
    renderConQuery();
    // wait for page to settle (empty state renders)
    await screen.findByText("No hay entradas en la lista de espera");
    const btn = screen.getByRole("button", { name: "Esperando" });
    fireEvent.click(btn);
    expect(btn.className).toContain("bg-slate-700");
  });
});

describe("ListaEsperaPage — visibilidad de acciones", () => {
  it("muestra 'Notificar' cuando estado es Esperando", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ estado: "Esperando" }),
    ]);
    renderConQuery();
    await screen.findByTitle("Marcar como notificado");
  });

  it("no muestra 'Notificar' cuando estado es Notificado", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ estado: "Notificado" }),
    ]);
    renderConQuery();
    // wait for the card to render (Confirmar is present for Notificado)
    await screen.findByTitle("Marcar como confirmado");
    expect(screen.queryByTitle("Marcar como notificado")).not.toBeInTheDocument();
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
  it("llama a cambiarEstado con 'Notificado' al hacer clic en Notificar", async () => {
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ id: "ent-1", estado: "Esperando" }),
    ]);
    renderConQuery();
    fireEvent.click(await screen.findByTitle("Marcar como notificado"));
    await waitFor(() => {
      expect(listaEsperaApi.cambiarEstado).toHaveBeenCalledWith("ent-1", "Notificado");
    });
  });
});

describe("ListaEsperaPage — eliminar entrada", () => {
  it("llama a eliminar cuando el usuario confirma", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ id: "ent-1" }),
    ]);
    renderConQuery();
    fireEvent.click(await screen.findByTitle("Eliminar"));
    await waitFor(() => {
      expect(listaEsperaApi.eliminar).toHaveBeenCalledWith("ent-1");
    });
  });

  it("no llama a eliminar cuando el usuario cancela", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(listaEsperaApi.obtener).mockResolvedValue([
      makeEntrada({ id: "ent-1" }),
    ]);
    renderConQuery();
    fireEvent.click(await screen.findByTitle("Eliminar"));
    await waitFor(() => {
      expect(listaEsperaApi.eliminar).not.toHaveBeenCalled();
    });
  });
});
