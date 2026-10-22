import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import DialogoEliminarConCitas from "./DialogoEliminarConCitas";

vi.mock("../ui/Modal", () => ({
  default: ({ abierto, titulo, children }: { abierto: boolean; titulo: string; children?: React.ReactNode }) =>
    abierto ? <div role="dialog" aria-label={titulo}>{children}</div> : null,
}));

vi.mock("../../lib/citasFuturas", () => ({
  contarCitasFuturas: vi.fn(),
  enlaceCitasFuturas: () => "/dashboard/citas?desde=2026-10-21&hasta=",
}));

import { contarCitasFuturas } from "../../lib/citasFuturas";

const props = {
  titulo: "Eliminar servicio",
  filtro: { servicioId: "svc-1" },
  mensaje: <p>¿Seguro?</p>,
  etiquetaEliminar: "Eliminar servicio",
  terminoCitas: { singular: "cita", plural: "citas" },
  alternativa: { etiqueta: "Ocultar de reservas", descripcion: "Ocúltalo.", onSelect: vi.fn() },
  onEliminar: vi.fn(),
  onCerrar: vi.fn(),
};

function renderDialogo(client: QueryClient, abierto = true) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DialogoEliminarConCitas {...props} abierto={abierto} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const nuevoCliente = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => vi.mocked(contarCitasFuturas).mockReset());

describe("DialogoEliminarConCitas — falla cerrada (OM-17)", () => {
  it("permite eliminar solo con un conteo completo en cero", async () => {
    vi.mocked(contarCitasFuturas).mockResolvedValue({ total: 0, completo: true });
    renderDialogo(nuevoCliente());
    expect(await screen.findByRole("button", { name: "Eliminar servicio" })).toBeInTheDocument();
  });

  it("con un conteo truncado (completo: false) bloquea la eliminación y deja ocultar", async () => {
    vi.mocked(contarCitasFuturas).mockResolvedValue({ total: 0, completo: false });
    renderDialogo(nuevoCliente());
    const dialogo = await screen.findByRole("dialog", { name: "No se puede eliminar todavía" });
    expect(dialogo).toHaveTextContent("No pudimos verificar todas las citas futuras");
    expect(screen.queryByRole("button", { name: "Eliminar servicio" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar de reservas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver citas desde hoy" })).toBeInTheDocument();
  });

  it("no usa un cero cacheado: al reabrir espera el conteo fresco antes de permitir eliminar", async () => {
    const client = nuevoCliente();
    vi.mocked(contarCitasFuturas).mockResolvedValueOnce({ total: 0, completo: true });
    const { rerender } = renderDialogo(client);
    expect(await screen.findByRole("button", { name: "Eliminar servicio" })).toBeInTheDocument();

    // Se cierra; mientras tanto aparece una cita. Al reabrir, el conteo aún no llega.
    const contenido = (abierto: boolean) => (
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DialogoEliminarConCitas {...props} abierto={abierto} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    rerender(contenido(false));
    let resolver: (v: { total: number; completo: boolean }) => void = () => {};
    vi.mocked(contarCitasFuturas).mockImplementationOnce(() => new Promise((r) => { resolver = r; }));
    rerender(contenido(true));

    expect(await screen.findByRole("status")).toHaveTextContent("Revisando citas futuras");
    expect(screen.queryByRole("button", { name: "Eliminar servicio" })).not.toBeInTheDocument();

    resolver({ total: 1, completo: true });
    await screen.findByRole("dialog", { name: "No se puede eliminar todavía" });
    expect(screen.queryByRole("button", { name: "Eliminar servicio" })).not.toBeInTheDocument();
    await waitFor(() => expect(contarCitasFuturas).toHaveBeenCalledTimes(2));
  });

  it("si el conteo falla no permite eliminar", async () => {
    vi.mocked(contarCitasFuturas).mockRejectedValueOnce(new Error("red"));
    renderDialogo(nuevoCliente());
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo comprobar");
    expect(screen.queryByRole("button", { name: "Eliminar servicio" })).not.toBeInTheDocument();
  });
});
