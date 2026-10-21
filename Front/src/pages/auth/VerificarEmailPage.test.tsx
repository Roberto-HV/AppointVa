import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VerificarEmailPage, { ESPERA_REENVIO_SEGUNDOS } from "./VerificarEmailPage";

vi.mock("../../api/axios", () => ({
  api: { get: vi.fn() },
}));

vi.mock("../../api/auth", () => ({
  reenviarVerificacion: vi.fn(),
}));

import { api } from "../../api/axios";
import { reenviarVerificacion } from "../../api/auth";

function renderEn(url = "/verificar-email?userId=u1&token=t1") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <VerificarEmailPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.useRealTimers();
  vi.mocked(api.get).mockReset();
  vi.mocked(reenviarVerificacion).mockReset();
});

describe("VerificarEmailPage (AP-03)", () => {
  it("con enlace vencido permite pedir uno nuevo con el correo", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockRejectedValue({
      response: { status: 400, data: { mensaje: "El enlace de verificación es inválido o ha expirado." } },
    });
    vi.mocked(reenviarVerificacion).mockResolvedValue({
      mensaje: "Si el correo está registrado y pendiente de verificación, recibirás un email.",
    });
    renderEn();

    expect(await screen.findByRole("heading", { name: "Enlace inválido o vencido" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Correo con el que te registraste"), "ana@ejemplo.com");
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));

    expect(reenviarVerificacion).toHaveBeenCalledWith("ana@ejemplo.com");
    expect(await screen.findByRole("status")).toHaveTextContent("Si el correo está registrado");
  });

  it("valida el correo antes de pedir el reenvío", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockRejectedValue({ response: { status: 400, data: {} } });
    renderEn();

    await screen.findByRole("heading", { name: "Enlace inválido o vencido" });
    await user.type(screen.getByLabelText("Correo con el que te registraste"), "no-es-correo");
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Escribe un correo válido.");
    expect(reenviarVerificacion).not.toHaveBeenCalled();
  });

  it("sin respuesta del servidor no dice que el enlace es inválido y ofrece reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ data: { mensaje: "¡Correo verificado! Ya puedes iniciar sesión." } });
    renderEn();

    expect(await screen.findByRole("heading", { name: "No pudimos comprobar el enlace" })).toBeInTheDocument();
    expect(screen.queryByText(/inválido/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "¡Correo verificado!" })).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it("un enlace incompleto ofrece el reenvío sin llamar al servidor", async () => {
    renderEn("/verificar-email");
    expect(await screen.findByRole("button", { name: "Reenviar enlace" })).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it.each([500, 503, 408, 429])("un %i es un error temporal con Reintentar, no un enlace inválido", async (status) => {
    vi.mocked(api.get).mockRejectedValue({ response: { status, data: { mensaje: "Error interno" } } });
    renderEn();
    expect(await screen.findByRole("heading", { name: "No pudimos comprobar el enlace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText(/inválido/i)).not.toBeInTheDocument();
  });

  it("tras reenviar permite volver a reenviar después de la espera o usar otro correo", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(api.get).mockRejectedValue({ response: { status: 400, data: {} } });
    vi.mocked(reenviarVerificacion).mockResolvedValue({ mensaje: "Si el correo está registrado, recibirás un email." });
    renderEn();

    await user.type(await screen.findByLabelText("Correo con el que te registraste"), "ana@ejemplo.com");
    await user.click(screen.getByRole("button", { name: "Reenviar enlace" }));
    await screen.findByRole("status");

    const otraVez = screen.getByRole("button", { name: /Reenviar de nuevo en \d+ s/ });
    expect(otraVez).toBeDisabled();

    for (let i = 0; i <= ESPERA_REENVIO_SEGUNDOS; i++) {
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    const habilitado = await screen.findByRole("button", { name: "Reenviar de nuevo" });
    expect(habilitado).toBeEnabled();
    await user.click(habilitado);
    await waitFor(() => expect(reenviarVerificacion).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole("button", { name: "Usar otro correo" }));
    const campo = screen.getByLabelText("Correo con el que te registraste");
    expect(campo).toHaveValue("ana@ejemplo.com");
    // La espera sigue vigente para cualquier correo.
    expect(screen.getByRole("button", { name: /Reenviar enlace en \d+ s/ })).toBeDisabled();
    vi.useRealTimers();
  });
});
