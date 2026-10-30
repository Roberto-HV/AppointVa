import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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
import { negociosApi } from "../api/negocios";
import { useAuthStore } from "../store/authStore";

/** Pantalla falsa fuera del layout: muestra a dónde se navegó y con qué estado. */
function Destino() {
  const { pathname, state } = useLocation();
  return <p data-testid="destino">{`${pathname} ${JSON.stringify(state)}`}</p>;
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <QueryClientProvider client={qc}>
        <Routes>
          <Route path="/dashboard/kiosk" element={<Destino />} />
          <Route path="*" element={<DashboardLayout />}>
            <Route path="dashboard/seguridad" element={<Destino />} />
            <Route path="*" element={null} />
          </Route>
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function comoPropietaria(perfil: Record<string, unknown> = {}) {
  vi.mocked(useAuthStore).mockReturnValue({
    usuario: { nombreCompleto: "Aramis Pérez", email: "aramis@test.com", rol: "Propietario" },
    refreshToken: null,
    cerrarSesion: vi.fn(),
  } as never);
  vi.mocked(negociosApi.obtenerPerfil).mockResolvedValue({
    slug: "salon", sector: "belleza", activo: true, moduloPagosHabilitado: true,
    listaEsperaActiva: false, ...perfil,
  } as never);
}

const menuPrincipal = () => screen.getByRole("complementary", { name: "Menú principal" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuthStore).mockReturnValue({
    usuario: { nombreCompleto: "Ana García", email: "ana@test.com", rol: "Empleado" },
    refreshToken: null,
    cerrarSesion: vi.fn(),
  } as never);
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

describe("DashboardLayout — navegación agrupada (I5)", () => {
  it("la dueña ve el menú en secciones con rótulo", async () => {
    comoPropietaria();
    renderizar();
    const agenda = await within(menuPrincipal()).findByRole("group", { name: "Agenda" });
    expect(within(agenda).getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/dashboard");
    expect(within(agenda).getByRole("link", { name: /Citas/ })).toHaveAttribute("href", "/dashboard/citas");
    expect(await within(agenda).findByRole("link", { name: "Pagos" })).toBeInTheDocument();
    expect(within(agenda).getByRole("button", { name: "Recepción" })).toBeInTheDocument();
    const equipo = within(menuPrincipal()).getByRole("group", { name: "Clientes y equipo" });
    expect(within(equipo).getByRole("link", { name: "Clientes" })).toHaveAttribute("href", "/dashboard/clientes");
    expect(within(equipo).getByRole("link", { name: "Empleados" })).toHaveAttribute("href", "/dashboard/empleados");
    const catalogo = within(menuPrincipal()).getByRole("group", { name: "Catálogo" });
    expect(within(catalogo).getByRole("link", { name: "Servicios" })).toBeInTheDocument();
    const negocio = within(menuPrincipal()).getByRole("group", { name: "Negocio" });
    expect(within(negocio).getByRole("link", { name: "Reportes" })).toHaveAttribute("href", "/dashboard/reportes");
  });

  it("Seguridad ya no está en el menú principal sino en el menú de usuario", async () => {
    comoPropietaria();
    renderizar();
    await within(menuPrincipal()).findByRole("group", { name: "Agenda" });
    expect(within(menuPrincipal()).queryByRole("link", { name: "Seguridad" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Menú de usuario" })[0]);
    // Los dos menús (móvil y escritorio) están en el DOM; el CSS muestra uno.
    fireEvent.click(screen.getAllByRole("button", { name: "Seguridad" })[0]);
    expect(screen.getByTestId("destino")).toHaveTextContent("/dashboard/seguridad");
  });

  it("Lista de espera aparece solo si el negocio la tiene activa", async () => {
    comoPropietaria({ listaEsperaActiva: false });
    const { unmount } = renderizar();
    await within(menuPrincipal()).findByRole("link", { name: "Pagos" });
    expect(within(menuPrincipal()).queryByRole("link", { name: "Lista de espera" })).not.toBeInTheDocument();
    unmount();

    comoPropietaria({ listaEsperaActiva: true });
    renderizar();
    expect(await within(menuPrincipal()).findByRole("link", { name: "Lista de espera" }))
      .toHaveAttribute("href", "/dashboard/espera");
  });

  it("la empleada no ve secciones ni Recepción, y sí Seguridad en su menú de usuario", async () => {
    renderizar();
    await screen.findAllByRole("link", { name: /pendientes por confirmar/ });
    expect(within(menuPrincipal()).queryByRole("group")).not.toBeInTheDocument();
    expect(within(menuPrincipal()).queryByRole("button", { name: "Recepción" })).not.toBeInTheDocument();
    expect(within(menuPrincipal()).getByRole("link", { name: /^Mis citas/ })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Menú de usuario" })[0]);
    expect(screen.getAllByRole("button", { name: "Seguridad" }).length).toBeGreaterThan(0);
  });
});

describe("DashboardLayout — Recepción confirma antes de cambiar la sesión (I6)", () => {
  it("abre una confirmación y 'Volver' no sale del panel", async () => {
    comoPropietaria();
    renderizar();
    fireEvent.click(await within(menuPrincipal()).findByRole("button", { name: "Recepción" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Activar el modo recepción?" });
    expect(dialogo).toHaveTextContent("Para volver al panel tendrás que escribir la contraseña de tu cuenta");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Volver" }));
    expect(screen.queryByRole("dialog", { name: "¿Activar el modo recepción?" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("destino")).not.toBeInTheDocument();
  });

  it("al confirmar navega a recepción marcada como confirmada", async () => {
    comoPropietaria();
    renderizar();
    fireEvent.click(await within(menuPrincipal()).findByRole("button", { name: "Recepción" }));
    const dialogo = await screen.findByRole("dialog", { name: "¿Activar el modo recepción?" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Activar recepción" }));
    expect(await screen.findByTestId("destino")).toHaveTextContent('/dashboard/kiosk {"recepcionConfirmada":true}');
  });
});
