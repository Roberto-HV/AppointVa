import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const cambiarPassword = vi.hoisted(() => vi.fn());
const obtenerEstado2FA = vi.hoisted(() => vi.fn());
vi.mock("../../api/auth", () => ({ authApi: { cambiarPassword, obtenerEstado2FA } }));

vi.mock("../../store/authStore", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ usuario: { nombreCompleto: "Admin Uno", email: "admin@test.com", rol: "SuperAdmin", fotoUrl: null } }),
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock("../../store/toastStore", () => ({ useToastStore: () => ({ toast }) }));

import CuentaAdminPage from "./CuentaAdminPage";

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/cuenta"]}>
        <CuentaAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  obtenerEstado2FA.mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
});

// Lote 1, G1: la cuenta del SuperAdmin.
describe("CuentaAdminPage", () => {
  it("muestra la cuenta del admin", () => {
    renderizar();
    expect(screen.getByRole("heading", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.getByText("Admin Uno")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("la verificación en dos pasos enlaza a la Seguridad del admin, no a la del panel", async () => {
    renderizar();
    const enlace = await screen.findByRole("link", { name: "Activar verificación en dos pasos" });
    expect(enlace).toHaveAttribute("href", "/admin/seguridad");
  });

  it("cambia la contraseña con la actual y la nueva", async () => {
    cambiarPassword.mockResolvedValue({ mensaje: "Contraseña actualizada correctamente. Inicia sesión nuevamente." });
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText("Contraseña actual"), "Actual-123");
    await user.type(screen.getByLabelText("Nueva contraseña"), "NuevaClave2026");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "NuevaClave2026");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await waitFor(() => expect(cambiarPassword).toHaveBeenCalledWith("Actual-123", "NuevaClave2026"));
    expect(await screen.findByRole("status")).toHaveTextContent("Inicia sesión nuevamente");
  });

  it("muestra el error del servidor si la contraseña actual no es correcta", async () => {
    cambiarPassword.mockRejectedValue({ response: { data: { errores: ["Contraseña incorrecta."] } } });
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText("Contraseña actual"), "Equivocada-1");
    await user.type(screen.getByLabelText("Nueva contraseña"), "NuevaClave2026");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "NuevaClave2026");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Contraseña incorrecta.");
  });
});
