import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RestablecerContrasenaPage from "./RestablecerContrasenaPage";
import RecuperarContrasenaPage from "./RecuperarContrasenaPage";

vi.mock("../../api/auth", () => ({
  authApi: { restablecerContrasena: vi.fn(), recuperarContrasena: vi.fn() },
}));

import { authApi } from "../../api/auth";

function renderEn(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/restablecer-contrasena" element={<RestablecerContrasenaPage />} />
        <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(authApi.restablecerContrasena).mockReset();
});

describe("RestablecerContrasenaPage (AP-14)", () => {
  it("un enlace incompleto ofrece pedir uno nuevo", async () => {
    const user = userEvent.setup();
    renderEn("/restablecer-contrasena?email=ana%40ejemplo.com");
    expect(screen.getByRole("heading", { name: "Enlace inválido o incompleto" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Solicitar un nuevo enlace" }));
    // El correo llega ya escrito, sin pasar por la URL.
    expect(await screen.findByLabelText("Correo electrónico")).toHaveValue("ana@ejemplo.com");
  });

  it("si el servidor rechaza el enlace, muestra su mensaje y la salida", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.restablecerContrasena).mockRejectedValue({
      response: { status: 400, data: { mensaje: "El enlace ha expirado." } },
    });
    renderEn("/restablecer-contrasena?token=t1&email=ana%40ejemplo.com");

    const [nueva, confirmar] = document.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]');
    await user.type(nueva, "Clave123");
    await user.type(confirmar, "Clave123");
    await user.click(screen.getByRole("button", { name: "Restablecer contraseña" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("El enlace ha expirado.");
    expect(screen.getByRole("link", { name: "Solicitar un nuevo enlace" })).toHaveAttribute("href", "/recuperar-contrasena");
  });
});
