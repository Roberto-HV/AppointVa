import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import KioskPage from "./KioskPage";
import { kioscoApi, type AgendaKiosco } from "../../api/kiosco";
import { useAuthStore } from "../../store/authStore";

// Real authStore and real MemoryRouter: only the network is mocked. Guards the
// exit flow against the page re-entering kiosk mode when the restored session
// re-renders it before the navigation to /dashboard/citas commits.

vi.mock("../../api/kiosco", () => ({
  kioscoApi: { iniciar: vi.fn(), agenda: vi.fn(), salir: vi.fn() },
}));

const USUARIO_KIOSCO = {
  id: "k-1", email: "dueno@negocio.mx", nombreCompleto: "Recepción", rol: "Kiosco", negocioId: "n-1",
};
const USUARIO_DUENO = {
  id: "u-1", email: "dueno@negocio.mx", nombreCompleto: "Dueña", rol: "Propietario", negocioId: "n-1",
};

const AGENDA: AgendaKiosco = {
  nombreNegocio: "Test Negocio", sector: "belleza", mostrarIngresos: true, empleados: [], citas: [],
};

function renderApp(inicial = "/dashboard/kiosk") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[inicial]}>
        <Routes>
          <Route path="/dashboard/kiosk" element={<KioskPage />} />
          <Route path="/dashboard/citas" element={<p>Pantalla de citas</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function salirConContrasena(valor: string) {
  const boton = await screen.findByRole("button", { name: /Salir del modo pantalla/ });
  fireEvent.pointerDown(boton);
  act(() => { vi.advanceTimersByTime(1500); });
  const dialogo = await screen.findByRole("dialog", { name: "Salir del modo recepción" });
  fireEvent.change(within(dialogo).getByLabelText("Contraseña"), { target: { value: valor } });
  fireEvent.click(within(dialogo).getByRole("button", { name: "Salir" }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  vi.mocked(kioscoApi.agenda).mockResolvedValue(AGENDA);
  vi.mocked(kioscoApi.iniciar).mockResolvedValue({
    token: "t-kiosco-2", tokenExpiracion: "", usuario: USUARIO_KIOSCO,
  });
  vi.mocked(kioscoApi.salir).mockResolvedValue({
    token: "t-dueno", refreshToken: "r-nuevo", tokenExpiracion: "", usuario: USUARIO_DUENO,
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("KioskPage — exit does not re-enter kiosk mode (real store + router)", () => {
  it("exiting from a kiosk session lands on Citas with the owner session", async () => {
    useAuthStore.setState({ token: "t-kiosco", refreshToken: null, usuario: USUARIO_KIOSCO });
    renderApp();

    await salirConContrasena("buena");

    expect(await screen.findByText("Pantalla de citas")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(kioscoApi.iniciar).not.toHaveBeenCalled();
    expect(useAuthStore.getState().usuario?.rol).toBe("Propietario");
    expect(useAuthStore.getState().refreshToken).toBe("r-nuevo");
  });

  it("entering from an owner session and then exiting does not enter again", async () => {
    useAuthStore.setState({ token: "t-dueno", refreshToken: "r-dueno", usuario: USUARIO_DUENO });
    renderApp();

    await screen.findByText("No hay empleados activos");
    expect(kioscoApi.iniciar).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().usuario?.rol).toBe("Kiosco");

    await salirConContrasena("buena");

    expect(await screen.findByText("Pantalla de citas")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(kioscoApi.iniciar).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().usuario?.rol).toBe("Propietario");
    expect(useAuthStore.getState().refreshToken).toBe("r-nuevo");
  });

  it("'Ir al panel' reaches Citas when the session is restored without navigating", async () => {
    useAuthStore.setState({ token: "t-kiosco", refreshToken: null, usuario: USUARIO_KIOSCO });
    renderApp();
    await screen.findByRole("button", { name: /Salir del modo pantalla/ });

    // Another tab exits kiosk mode: the session changes but this tab never navigates.
    act(() => { useAuthStore.setState({ token: "t-dueno", refreshToken: "r-dueno", usuario: USUARIO_DUENO }); });
    expect(screen.getByRole("status")).toHaveTextContent("Volviendo al panel…");

    fireEvent.click(screen.getByRole("button", { name: "Ir al panel" }));

    expect(await screen.findByText("Pantalla de citas")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(kioscoApi.iniciar).not.toHaveBeenCalled();
    expect(useAuthStore.getState().usuario?.rol).toBe("Propietario");
  });
});
