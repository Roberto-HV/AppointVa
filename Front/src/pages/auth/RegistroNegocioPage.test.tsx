import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegistroNegocioPage from "./RegistroNegocioPage";
import { ACTIVACION_RESUMEN } from "../../lib/activacion";

vi.mock("../../api/axios", () => ({
  api: { post: vi.fn(), get: vi.fn() },
}));

vi.mock("../../api/auth", () => ({
  verificarSlug: vi.fn().mockResolvedValue({ disponible: true }),
  reenviarVerificacion: vi.fn(),
}));

import { api } from "../../api/axios";
import { reenviarVerificacion } from "../../api/auth";

function renderEn(url = "/registro") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <RegistroNegocioPage />
    </MemoryRouter>
  );
}

async function llenarFormulario(user: ReturnType<typeof userEvent.setup>, contrasena = "Clave123") {
  await user.type(screen.getByPlaceholderText("Ej. Salón Belleza Luna"), "Clínica Sur");
  await user.type(screen.getByPlaceholderText("Nombre y apellido"), "Ana Pérez");
  await user.type(screen.getByPlaceholderText("correo@ejemplo.com"), "ana@ejemplo.com");
  const [pass, confirmar] = document.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]');
  await user.type(pass, contrasena);
  await user.type(confirmar, contrasena);
  // El botón espera a que termine la comprobación del identificador.
  await screen.findByText("Disponible");
}

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(reenviarVerificacion).mockReset();
});

describe("RegistroNegocioPage — giro del negocio (AP-01)", () => {
  it("sin parámetro preselecciona Belleza y permite elegir Salud", async () => {
    const user = userEvent.setup();
    renderEn("/registro");

    const belleza = screen.getByRole("radio", { name: /Belleza y estética/ });
    const salud = screen.getByRole("radio", { name: /Salud/ });
    expect(belleza).toHaveAttribute("aria-checked", "true");
    expect(salud).toBeEnabled();

    await user.click(salud);
    expect(salud).toHaveAttribute("aria-checked", "true");
    expect(belleza).toHaveAttribute("aria-checked", "false");
  });

  it("?sector=salud preselecciona Salud pero no bloquea el cambio", async () => {
    const user = userEvent.setup();
    renderEn("/registro?sector=salud");

    const belleza = screen.getByRole("radio", { name: /Belleza y estética/ });
    expect(screen.getByRole("radio", { name: /Salud/ })).toHaveAttribute("aria-checked", "true");
    expect(belleza).toBeEnabled();
    expect(screen.queryByText(/pre-seleccionado/i)).not.toBeInTheDocument();

    await user.click(belleza);
    expect(belleza).toHaveAttribute("aria-checked", "true");
  });

  it("las flechas cambian el giro como en un grupo de radio", async () => {
    const user = userEvent.setup();
    renderEn("/registro");
    screen.getByRole("radio", { name: /Belleza y estética/ }).focus();
    await user.keyboard("{ArrowRight}");
    const salud = screen.getByRole("radio", { name: /Salud/ });
    expect(salud).toHaveAttribute("aria-checked", "true");
    expect(salud).toHaveFocus();
  });

  it("envía el giro elegido al servidor", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    renderEn("/registro");

    await user.click(screen.getByRole("radio", { name: /Salud/ }));
    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ sector: "salud" });
  });
});

describe("RegistroNegocioPage — reglas de contraseña (AP-12)", () => {
  it("muestra las reglas siempre y las marca al cumplirse", async () => {
    const user = userEvent.setup();
    renderEn();
    const lista = screen.getByRole("list", { name: "Requisitos de la contraseña" });
    expect(lista).toHaveTextContent("Una letra minúscula");

    const [pass] = document.querySelectorAll<HTMLInputElement>('input[autocomplete="new-password"]');
    await user.type(pass, "CLAVE1");
    const minuscula = screen.getByText("Una letra minúscula").closest("li")!;
    const mayuscula = screen.getByText("Una letra mayúscula").closest("li")!;
    expect(minuscula).toHaveAttribute("data-cumple", "false");
    expect(mayuscula).toHaveAttribute("data-cumple", "true");
  });

  it("no envía una contraseña sin minúscula que el servidor rechazaría", async () => {
    const user = userEvent.setup();
    renderEn();
    await llenarFormulario(user, "CLAVE123");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Debe tener al menos una minúscula")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("traduce los motivos que devuelve Identity", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { mensaje: "No se pudo crear la cuenta.", errores: ["Passwords must have at least one lowercase ('a'-'z')."] } },
    });
    renderEn();
    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No se pudo crear la cuenta.");
    expect(alerta).toHaveTextContent("La contraseña debe tener al menos una minúscula.");
  });
});

describe("RegistroNegocioPage — pantalla de éxito (AP-02, AP-03)", () => {
  async function registrar() {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({ data: {} });
    renderEn();
    await llenarFormulario(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await screen.findByRole("heading", { name: "¡Revisa tu correo!" });
    return user;
  }

  it("explica qué sigue con el mismo mensaje de activación que la FAQ y el panel", async () => {
    await registrar();
    expect(screen.getByRole("heading", { name: "Qué sigue" })).toBeInTheDocument();
    expect(screen.getByText(ACTIVACION_RESUMEN)).toBeInTheDocument();
    expect(screen.getByText(/Vence en 24 horas/)).toBeInTheDocument();
  });

  it("da una salida si el correo se escribió mal", async () => {
    await registrar();
    expect(screen.getByText(/¿Escribiste mal tu correo\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "hola@appointva.com" })).toHaveAttribute("href", "mailto:hola@appointva.com");
  });

  it("muestra el error del reenvío en la propia pantalla", async () => {
    const user = await registrar();
    vi.mocked(reenviarVerificacion).mockRejectedValue(new Error("red"));
    await user.click(screen.getByRole("button", { name: /Reenviar correo/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo reenviar el correo");
    expect(reenviarVerificacion).toHaveBeenCalledWith("ana@ejemplo.com");
  });
});
