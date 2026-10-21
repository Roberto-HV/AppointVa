import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import VerificarEmailPage from "./VerificarEmailPage";

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
});
