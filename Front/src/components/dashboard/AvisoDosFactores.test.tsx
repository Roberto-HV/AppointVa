import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AvisoDosFactores from "./AvisoDosFactores";
import { authApi } from "../../api/auth";

vi.mock("../../api/auth", () => ({ authApi: { obtenerEstado2FA: vi.fn() } }));

function renderAviso(esPropietario = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <AvisoDosFactores esPropietario={esPropietario} />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AvisoDosFactores (DC-29, decisión 9; M4: un solo aviso)", () => {
  it("con 2FA apagado recomienda activarlo y enlaza a Seguridad, donde se configura", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    renderAviso();
    expect(await screen.findByRole("link", { name: "Activar verificación en dos pasos" })).toHaveAttribute("href", "/dashboard/seguridad");
    expect(screen.getByRole("heading", { name: "Verificación en dos pasos" })).toBeInTheDocument();
    expect(screen.getByText(/proteger tu negocio/)).toBeInTheDocument();
  });

  it("al empleado no le habla de 'tu negocio'", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    renderAviso(false);
    await screen.findByRole("link", { name: "Activar verificación en dos pasos" });
    expect(screen.queryByText(/tu negocio/)).not.toBeInTheDocument();
  });

  it("con 2FA activo y pocos códigos de recuperación, avisa en la misma tarjeta (B8)", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 2 });
    renderAviso();
    expect(await screen.findByText(/Te quedan 2 códigos de recuperación/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Generar códigos nuevos" })).toHaveAttribute("href", "/dashboard/seguridad");
  });

  it("sin códigos de recuperación lo dice claro", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 0 });
    renderAviso();
    expect(await screen.findByText(/ya no te quedan códigos de recuperación/)).toBeInTheDocument();
  });

  it("con 2FA activo y códigos suficientes solo informa y ofrece administrarlo", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 10 });
    renderAviso();
    expect(await screen.findByRole("link", { name: "Administrar" })).toHaveAttribute("href", "/dashboard/seguridad");
    expect(screen.queryByRole("link", { name: /activar/i })).not.toBeInTheDocument();
  });
});
