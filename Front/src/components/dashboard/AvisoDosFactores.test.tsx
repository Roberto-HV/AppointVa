import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AvisoDosFactores from "./AvisoDosFactores";
import { authApi } from "../../api/auth";

vi.mock("../../api/auth", () => ({ authApi: { obtenerEstado2FA: vi.fn() } }));

function renderAviso() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AvisoDosFactores usuarioId="u1" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("AvisoDosFactores (DC-29, decisión 9)", () => {
  it("con 2FA apagado recomienda activarlo y enlaza a Seguridad", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: false, tieneConfiguracion: false });
    renderAviso();
    expect(await screen.findByRole("heading", { name: /verificación en dos pasos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Activar ahora" })).toHaveAttribute("href", "/dashboard/seguridad");
  });

  it("se puede descartar y no vuelve a aparecer en este navegador", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: false, tieneConfiguracion: false });
    const { unmount } = renderAviso();
    fireEvent.click(await screen.findByRole("button", { name: /Descartar el aviso/ }));
    expect(screen.queryByRole("heading", { name: /verificación en dos pasos/ })).not.toBeInTheDocument();
    unmount();
    renderAviso();
    expect(screen.queryByRole("heading", { name: /verificación en dos pasos/ })).not.toBeInTheDocument();
  });

  it("no aparece si 2FA ya está activo", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true });
    renderAviso();
    await vi.waitFor(() => expect(authApi.obtenerEstado2FA).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: /verificación en dos pasos/ })).not.toBeInTheDocument();
  });
});
