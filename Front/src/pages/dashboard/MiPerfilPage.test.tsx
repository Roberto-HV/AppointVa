import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MiPerfilPage from "./MiPerfilPage";
import { useToastStore } from "../../store/toastStore";

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../api/auth", () => ({
  authApi: {
    cambiarPassword: vi.fn(),
    subirFotoPerfil: vi.fn(),
    obtenerEstado2FA: vi.fn().mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 }),
  },
}));

vi.mock("../../api/me", () => ({
  meApi: { obtenerMiEmpleado: vi.fn().mockResolvedValue({ empleadoId: "emp-1", nombre: "Ana" }) },
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerBloqueos: vi.fn(),
    crearBloqueo: vi.fn().mockResolvedValue({}),
    eliminarBloqueo: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerHorarios: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../api/citas", () => ({
  citasApi: { obtenerTodas: vi.fn().mockResolvedValue({ datos: [] }) },
}));

vi.mock("../../components/ui/NotificacionBanner", () => ({
  NotificacionPerfilSection: () => null,
}));

import { useAuthStore } from "../../store/authStore";
import { empleadosApi } from "../../api/empleados";

const empleado = { id: "u2", email: "ana@test.com", nombreCompleto: "Ana García", rol: "Empleado", negocioId: null };

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <MiPerfilPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  act(() => useToastStore.setState({ toasts: [] }));
  vi.mocked(useAuthStore).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selector: (s: any) => unknown) => selector({ usuario: empleado, actualizarFoto: vi.fn() }),
  );
  vi.mocked(empleadosApi.obtenerBloqueos).mockResolvedValue([
    { id: "b1", inicioEn: "2026-10-22T15:00:00", finEn: "2026-10-22T17:00:00", motivo: "Médico" },
  ]);
});

describe("MiPerfilPage — contraseñas (DC-19)", () => {
  it("cada campo tiene etiqueta y su botón de mostrar es alcanzable y tiene nombre", () => {
    renderizar();
    const actual = screen.getByLabelText("Contraseña actual");
    expect(actual).toHaveAttribute("autocomplete", "current-password");
    const mostrar = screen.getByRole("button", { name: "Mostrar contraseña actual" });
    expect(mostrar).not.toHaveAttribute("tabindex", "-1");
    fireEvent.click(mostrar);
    expect(actual).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña actual" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("MiPerfilPage — seguridad (DC-29)", () => {
  it("el empleado llega a la verificación en dos pasos desde su perfil", async () => {
    renderizar();
    expect(await screen.findByRole("link", { name: "Activar verificación en dos pasos" })).toHaveAttribute("href", "/dashboard/seguridad");
  });

  it("la verificación en dos pasos se menciona una sola vez (M4)", async () => {
    renderizar();
    await screen.findByRole("link", { name: "Activar verificación en dos pasos" });
    expect(screen.getAllByRole("link", { name: /verificación en dos pasos/i })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: /verificación en dos pasos/i })).toHaveLength(1);
  });
});

describe("MiPerfilPage — eliminar un bloqueo se puede deshacer (DC-33)", () => {
  it("borra al instante y 'Deshacer' vuelve a crear el mismo bloqueo en UTC", async () => {
    renderizar();
    fireEvent.click(await screen.findByRole("button", { name: /Eliminar bloqueo del/ }));
    await waitFor(() => expect(empleadosApi.eliminarBloqueo).toHaveBeenCalledWith("emp-1", "b1"));

    const aviso = await waitFor(() => {
      const t = useToastStore.getState().toasts.find((x) => x.mensaje === "Bloqueo eliminado");
      expect(t?.accion?.etiqueta).toBe("Deshacer");
      return t!;
    });
    act(() => useToastStore.getState().ejecutarAccion(aviso.id));
    await waitFor(() =>
      expect(empleadosApi.crearBloqueo).toHaveBeenCalledWith("emp-1", {
        inicioEn: "2026-10-22T15:00:00Z",
        finEn: "2026-10-22T17:00:00Z",
        motivo: "Médico",
      }),
    );
  });
});

describe("MiPerfilPage — foto de perfil", () => {
  it("valida tipo y tamaño antes de subir, como los demás subidores", async () => {
    const { authApi } = await import("../../api/auth");
    renderizar();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toContain("image/webp");

    fireEvent.change(input, { target: { files: [new File(["x"], "foto.heic", { type: "image/heic" })] } });
    expect(authApi.subirFotoPerfil).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]).toMatchObject({ tipo: "error", mensaje: '"foto.heic" no es JPG, PNG, WebP o GIF.' });

    vi.mocked(authApi.subirFotoPerfil).mockResolvedValue({ fotoUrl: "https://x/f.png" });
    fireEvent.change(input, { target: { files: [new File(["x"], "foto.png", { type: "image/png" })] } });
    await waitFor(() => expect(authApi.subirFotoPerfil).toHaveBeenCalled());
  });
});
