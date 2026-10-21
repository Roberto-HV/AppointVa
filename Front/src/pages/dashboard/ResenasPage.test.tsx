import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ResenasPage from "./ResenasPage";

vi.mock("../../api/me", () => ({ meApi: { obtenerResenas: vi.fn() } }));
import { meApi } from "../../api/me";

const resena = (over: Record<string, unknown> = {}) => ({
  id: "r1", rating: 4, comentario: "Muy bien", nombreCliente: "Ana López",
  fechaCreacion: "2026-10-01T15:00:00Z", respondida: false, aprobada: true, ...over,
});

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ResenasPage /></QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("ResenasPage (OM-21, partes sin decisión)", () => {
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

  it("si hay reseñas pero ninguna aprobada en la página no dice 'Aún no tienes reseñas'", async () => {
    vi.mocked(meApi.obtenerResenas).mockResolvedValue({ items: [resena({ aprobada: false })], total: 14 } as never);
    renderizar();
    expect(await screen.findByText("Ninguna reseña aprobada en esta página")).toBeInTheDocument();
    expect(screen.queryByText("Aún no tienes reseñas")).toBeNull();
  });

  it("un fallo de carga ofrece reintentar", async () => {
    vi.mocked(meApi.obtenerResenas).mockRejectedValue(new Error("red"));
    renderizar();
    expect(await screen.findByText("No se pudieron cargar las reseñas.")).toBeInTheDocument();
  });
});
