import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ResenasPage from "./ResenasPage";

vi.mock("../../api/me", () => ({ meApi: { obtenerResenas: vi.fn() } }));
vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerPerfil: vi.fn().mockResolvedValue({ sector: "belleza" }) },
}));
import { meApi } from "../../api/me";

const resena = (over: Record<string, unknown> = {}) => ({
  id: "r1", rating: 4, comentario: "Muy bien", nombreCliente: "Ana López",
  fechaCreacion: "2026-10-01T15:00:00Z", respondida: false, aprobada: true, ...over,
});

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}><ResenasPage /></QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ResenasPage (OM-21)", () => {
  it("las estrellas se anuncian como texto", async () => {
    vi.mocked(meApi.obtenerResenas).mockResolvedValue({ items: [resena()], total: 1 } as never);
    renderizar();
    expect(await screen.findByRole("img", { name: "4 de 5 estrellas" })).toBeInTheDocument();
  });

  it("un comentario largo se puede leer completo sin salir de la tabla", async () => {
    const largo = "a".repeat(140);
    vi.mocked(meApi.obtenerResenas).mockResolvedValue({ items: [resena({ comentario: largo })], total: 1 } as never);
    renderizar();
    const ver = await screen.findByRole("button", { name: "Ver más" });
    expect(ver).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(largo, { exact: false })).toBeNull();
    fireEvent.click(ver);
    expect(screen.getByText(largo, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
  });

  it("el promedio y la distribución vienen del servidor, no de la página (B15)", async () => {
    // Página con una sola reseña de 4: el promedio mostrado es el del servidor (4.7).
    vi.mocked(meApi.obtenerResenas).mockResolvedValue({
      items: [resena()], total: 14, promedio: 4.7,
      distribucion: { "1": 0, "2": 0, "3": 1, "4": 2, "5": 11 },
    } as never);
    renderizar();
    expect(await screen.findByText("4.7")).toBeInTheDocument();
    expect(screen.getByText("promedio de todas")).toBeInTheDocument();
    const filas = screen.getAllByRole("listitem");
    expect(filas[0]).toHaveTextContent("5 estrellas11");
    expect(filas[4]).toHaveTextContent("1 estrella0");
    expect(screen.getByText("14 reseñas publicadas")).toBeInTheDocument();
  });

  it("sin reseñas aprobadas dice 'Aún no tienes reseñas' y no muestra promedio", async () => {
    vi.mocked(meApi.obtenerResenas).mockResolvedValue({
      items: [], total: 0, promedio: null, distribucion: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
    } as never);
    renderizar();
    expect(await screen.findByText("Aún no tienes reseñas")).toBeInTheDocument();
    expect(screen.queryByText("promedio de todas")).toBeNull();
    // El vacío ofrece un siguiente paso: las reseñas se piden desde la cita.
    expect(screen.getByRole("link", { name: /ir a citas/i })).toHaveAttribute("href", "/dashboard/citas");
  });

  it("un fallo de carga ofrece reintentar", async () => {
    vi.mocked(meApi.obtenerResenas).mockRejectedValue(new Error("red"));
    renderizar();
    expect(await screen.findByText("No se pudieron cargar las reseñas.")).toBeInTheDocument();
  });
});
