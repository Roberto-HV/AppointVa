import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const estadoInactividad = vi.hoisted(() => ({ aviso: false, seguir: vi.fn() }));

vi.mock("../hooks/useInactividadTimeout", () => ({
  useInactividadTimeout: () => estadoInactividad,
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    usuario: { nombreCompleto: "Ana García", email: "ana@test.com", rol: "Empleado" },
    refreshToken: null,
    cerrarSesion: vi.fn(),
  })),
}));

vi.mock("../api/citas", () => ({
  citasApi: { obtenerTodas: vi.fn() },
  ESTADOS: { Pendiente: 1, Confirmada: 2, Completada: 3, Cancelada: 4, Inasistencia: 5 },
}));

vi.mock("../api/negocios", () => ({ negociosApi: { obtenerPerfil: vi.fn() } }));
vi.mock("../api/encuesta", () => ({ encuestaApi: { obtenerEstado: vi.fn() } }));
vi.mock("../api/auth", () => ({ authApi: { logout: vi.fn() } }));
vi.mock("../components/dashboard/NotificacionesBell", () => ({ NotificacionesBell: () => null }));

import DashboardLayout from "./DashboardLayout";
import { citasApi } from "../api/citas";

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <QueryClientProvider client={qc}>
        <DashboardLayout />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  estadoInactividad.aviso = false;
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue({
    datos: [
      { id: "c1", estado: 1, finEn: new Date(Date.now() + 3_600_000).toISOString() },
      { id: "c2", estado: 1, finEn: new Date(Date.now() + 7_200_000).toISOString() },
    ],
    total: 2,
    pagina: 1,
    tamano: 15,
  } as never);
});

describe("DashboardLayout — pendientes (DC-25)", () => {
  it("el aviso de pendientes está en ambas barras y lleva a la lista filtrada", async () => {
    renderizar();
    const enlaces = await screen.findAllByRole("link", { name: /2 citas pendientes por confirmar/ });
    // Uno en el header móvil y otro en la barra de escritorio.
    expect(enlaces).toHaveLength(2);
    for (const e of enlaces) expect(e).toHaveAttribute("href", "/dashboard/citas?estado=Pendiente");
  });
});

describe("DashboardLayout — inactividad (DC-27)", () => {
  it("avisa antes de cerrar la sesión y 'Seguir conectado' la mantiene", async () => {
    estadoInactividad.aviso = true;
    renderizar();
    expect(await screen.findByRole("dialog", { name: "¿Sigues ahí?" })).toBeInTheDocument();
    screen.getByRole("button", { name: "Seguir conectado" }).click();
    expect(estadoInactividad.seguir).toHaveBeenCalled();
  });
});
