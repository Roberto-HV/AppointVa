import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CalendarioCitas from "./CalendarioCitas";

vi.mock("../../api/citas", () => ({
  citasApi: { obtenerTodas: vi.fn() },
}));

import { citasApi } from "../../api/citas";

const matchMediaOriginal = window.matchMedia;

function simularMovil(movil: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: movil && q.includes("max-width"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarioCitas empleadoId="" onCitaClick={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 15 });
});
afterEach(() => {
  window.matchMedia = matchMediaOriginal;
});

describe("CalendarioCitas — vista inicial (DC-23)", () => {
  it("en el teléfono abre en vista día", () => {
    simularMovil(true);
    renderizar();
    expect(screen.getByRole("button", { name: "Vista día" })).toHaveAttribute("aria-pressed", "true");
  });

  it("en escritorio abre en vista semana", () => {
    simularMovil(false);
    renderizar();
    expect(screen.getByRole("button", { name: "Vista semana" })).toHaveAttribute("aria-pressed", "true");
  });

  it("recuerda la vista elegida en este dispositivo", () => {
    simularMovil(true);
    const { unmount } = renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Vista semana" }));
    unmount();
    renderizar();
    expect(screen.getByRole("button", { name: "Vista semana" })).toHaveAttribute("aria-pressed", "true");
  });

  it("los controles de navegación tienen nombre y 44px en táctil", () => {
    simularMovil(true);
    renderizar();
    const anterior = screen.getByRole("button", { name: "Día anterior" });
    expect(anterior.className).toContain("min-h-[44px]");
  });
});

describe("CalendarioCitas — error (DC-32)", () => {
  it("un fallo al cargar se avisa con 'Reintentar' en vez de mostrar días vacíos", async () => {
    vi.mocked(citasApi.obtenerTodas).mockRejectedValueOnce(new Error("red"));
    renderizar();
    expect(await screen.findByText(/No se pudo cargar el calendario/)).toBeInTheDocument();
    vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 15 });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await vi.waitFor(() => expect(citasApi.obtenerTodas).toHaveBeenCalledTimes(2));
  });
});
