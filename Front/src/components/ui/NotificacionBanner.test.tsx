import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificacionPerfilSection } from "./NotificacionBanner";

vi.mock("../../hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    permiso: "denied",
    suscrito: false,
    soportado: true,
    cargando: false,
    error: null,
    setError: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
  }),
}));

// jsdom no trae `matchMedia`; el componente lo usa para saber si corre instalada.
window.matchMedia ??= ((q: string) => ({
  matches: false, media: q, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(),
  addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
})) as unknown as typeof window.matchMedia;

describe("NotificacionPerfilSection (M5)", () => {
  it("con el permiso bloqueado es una sola línea y los pasos quedan plegados tras la ayuda", async () => {
    render(<NotificacionPerfilSection />);
    expect(screen.getByText("Las notificaciones están bloqueadas en este navegador.")).toBeInTheDocument();
    const pasos = screen.getByText("Recarga la página.");
    expect(pasos).not.toBeVisible();

    await userEvent.click(screen.getByText("¿Cómo desbloquearlas?"));
    expect(pasos).toBeVisible();
  });
});
