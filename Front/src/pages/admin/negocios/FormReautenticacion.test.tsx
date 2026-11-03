import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormReautenticacion from "./FormReautenticacion";
import { guardarPrueba, olvidarPrueba, pruebaVigente } from "../../../lib/pruebaReautenticacion";

const authMock = vi.hoisted(() => ({ reautenticar: vi.fn(), obtenerEstado2FA: vi.fn() }));
vi.mock("../../../api/auth", () => ({ authApi: authMock }));

function renderizar(props: Partial<Parameters<typeof FormReautenticacion>[0]> = {}) {
  const onConfirmado = vi.fn();
  const onCancelar = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FormReautenticacion accion="eliminar Demo" onConfirmado={onConfirmado} onCancelar={onCancelar} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onConfirmado, onCancelar };
}

beforeEach(() => {
  vi.clearAllMocks();
  olvidarPrueba();
  authMock.obtenerEstado2FA.mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 10 });
});

afterEach(() => vi.useRealTimers());

describe("FormReautenticacion", () => {
  it("pide contraseña y código, y guarda la prueba en memoria al confirmar", async () => {
    const user = userEvent.setup();
    const expiracion = new Date(Date.now() + 5 * 60_000).toISOString();
    authMock.reautenticar.mockResolvedValue({ token: "prueba-1", expiracion });
    const { onConfirmado } = renderizar();

    expect(screen.getByText(/Vas a eliminar Demo/)).toBeInTheDocument();
    const confirmar = screen.getByRole("button", { name: "Confirmar y continuar" });
    expect(confirmar).toBeDisabled();
    await user.type(screen.getByLabelText("Tu contraseña"), "Clave-1");
    await user.type(screen.getByLabelText("Código de verificación"), "123456");
    await user.click(confirmar);

    await waitFor(() => expect(onConfirmado).toHaveBeenCalledWith("prueba-1"));
    expect(authMock.reautenticar).toHaveBeenCalledWith("Clave-1", "123456");
    expect(pruebaVigente()).toBe("prueba-1");
    expect(localStorage.length).toBe(0);
  });

  it("si la cuenta no tiene 2FA, no pide nada: lleva a activarla", async () => {
    authMock.obtenerEstado2FA.mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    renderizar();
    expect(await screen.findByRole("link", { name: "Activar verificación en dos pasos" })).toHaveAttribute("href", "/admin/seguridad");
    expect(screen.queryByLabelText("Tu contraseña")).not.toBeInTheDocument();
  });

  it("si el servidor responde 2FA_REQUERIDO, también lleva a activarla", async () => {
    const user = userEvent.setup();
    authMock.reautenticar.mockRejectedValue({ response: { status: 403, data: { mensaje: "Activa la verificación", codigoError: "2FA_REQUERIDO" } } });
    const { onConfirmado } = renderizar();
    await user.type(screen.getByLabelText("Tu contraseña"), "Clave-1");
    await user.type(screen.getByLabelText("Código de verificación"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar y continuar" }));
    expect(await screen.findByRole("link", { name: "Activar verificación en dos pasos" })).toBeInTheDocument();
    expect(onConfirmado).not.toHaveBeenCalled();
  });

  it("con 429 dice que hay demasiados intentos, no que el código está mal", async () => {
    const user = userEvent.setup();
    authMock.reautenticar.mockRejectedValue({ response: { status: 429, data: { mensaje: "Demasiadas solicitudes. Intenta de nuevo en un momento." } } });
    const { onConfirmado } = renderizar();
    await user.type(screen.getByLabelText("Tu contraseña"), "Clave-1");
    await user.type(screen.getByLabelText("Código de verificación"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar y continuar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos. Espera unos minutos");
    expect(onConfirmado).not.toHaveBeenCalled();
  });

  it("Cancelar avisa sin llamar al servidor", async () => {
    const user = userEvent.setup();
    const { onCancelar } = renderizar();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancelar).toHaveBeenCalled();
    expect(authMock.reautenticar).not.toHaveBeenCalled();
  });
});

describe("prueba de reautenticación en memoria", () => {
  it("deja de servir poco antes de vencer y se puede olvidar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    guardarPrueba("p", "2026-11-03T12:05:00Z");
    expect(pruebaVigente()).toBe("p");
    vi.setSystemTime(new Date("2026-11-03T12:04:50Z"));
    expect(pruebaVigente()).toBeNull();

    vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
    guardarPrueba("q", "2026-11-03T12:05:00Z");
    olvidarPrueba();
    expect(pruebaVigente()).toBeNull();
  });
});
