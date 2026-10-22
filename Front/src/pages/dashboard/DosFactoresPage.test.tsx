import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DosFactoresPage from "./DosFactoresPage";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code" aria-label={value} />
  ),
}));

vi.mock("../../api/auth", () => ({
  authApi: {
    obtenerEstado2FA: vi.fn(),
    configurar2FA: vi.fn(),
    activar2FA: vi.fn(),
    desactivar2FA: vi.fn(),
    regenerarCodigosRecuperacion: vi.fn(),
  },
}));

const CODIGOS = Array.from({ length: 10 }, (_, i) => `AAAA${i}-BBBB${i}`);

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: vi.fn() }),
}));

import { authApi } from "../../api/auth";

// ── Helper ───────────────────────────────────────────────────────────────────

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <DosFactoresPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DosFactoresPage — idle: 2FA desactivado", () => {
  it("muestra el subtítulo y el botón para activar", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: false,
      tieneConfiguracion: false,
      codigosRecuperacionRestantes: 0,
    });
    renderConQuery();
    await screen.findByText("Autenticación de dos factores (2FA)");
    expect(
      screen.getByRole("button", { name: "Activar autenticación en dos pasos" })
    ).toBeInTheDocument();
  });
});

describe("DosFactoresPage — idle: 2FA activado", () => {
  it("muestra el estado '2FA activado' cuando está habilitado", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: true,
      tieneConfiguracion: true,
      codigosRecuperacionRestantes: 10,
    });
    renderConQuery();
    await screen.findByText("2FA activado");
  });
});

describe("DosFactoresPage — flujo activación: paso 1 (QR)", () => {
  it("llama a configurar2FA y muestra la llave manual", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: false,
      tieneConfiguracion: false,
      codigosRecuperacionRestantes: 0,
    });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({
      uri: "otpauth://totp/test?secret=ABCD1234",
      llave: "ABCD1234",
    });
    renderConQuery();
    fireEvent.click(
      await screen.findByRole("button", { name: "Activar autenticación en dos pasos" })
    );
    await screen.findByText("ABCD1234");
    expect(authApi.configurar2FA).toHaveBeenCalledTimes(1);
  });
});

describe("DosFactoresPage — flujo activación: input de código", () => {
  it("habilita el botón confirmar al escribir 6 dígitos", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: false,
      tieneConfiguracion: false,
      codigosRecuperacionRestantes: 0,
    });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({
      uri: "otpauth://totp/test?secret=ABCD1234",
      llave: "ABCD1234",
    });
    renderConQuery();
    fireEvent.click(
      await screen.findByRole("button", { name: "Activar autenticación en dos pasos" })
    );
    const input = await screen.findByPlaceholderText("000000");
    const btnConfirmar = screen.getByRole("button", { name: "Confirmar activación" });
    expect(btnConfirmar).toBeDisabled();
    fireEvent.change(input, { target: { value: "123456" } });
    expect(btnConfirmar).not.toBeDisabled();
  });
});

describe("DosFactoresPage — flujo activación: éxito", () => {
  it("llama a activar2FA con el código y muestra el mensaje de éxito", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: false,
      tieneConfiguracion: false,
      codigosRecuperacionRestantes: 0,
    });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({
      uri: "otpauth://totp/test?secret=ABCD1234",
      llave: "ABCD1234",
    });
    vi.mocked(authApi.activar2FA).mockResolvedValue({ mensaje: "OK", codigosRecuperacion: CODIGOS });
    renderConQuery();
    fireEvent.click(
      await screen.findByRole("button", { name: "Activar autenticación en dos pasos" })
    );
    fireEvent.change(await screen.findByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar activación" }));
    await screen.findByText("¡2FA activado correctamente!");
    expect(authApi.activar2FA).toHaveBeenCalledWith("123456");
  });

  it("Enter con el código escrito confirma la activación y anuncia los códigos de recuperación", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({ uri: "otpauth://totp/test?secret=ABCD1234", llave: "ABCD1234" });
    vi.mocked(authApi.activar2FA).mockResolvedValue({ mensaje: "OK", codigosRecuperacion: CODIGOS });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Activar autenticación en dos pasos" }));
    const campo = await screen.findByPlaceholderText("000000");
    expect(screen.getByText(/10 códigos de recuperación/)).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: "654321" } });
    fireEvent.submit(campo.closest("form")!);
    await waitFor(() => expect(authApi.activar2FA).toHaveBeenCalledWith("654321"));
  });
});

describe("DosFactoresPage — flujo activación: código incorrecto", () => {
  it("muestra el error del servidor cuando el código es inválido", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: false,
      tieneConfiguracion: false,
      codigosRecuperacionRestantes: 0,
    });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({
      uri: "otpauth://totp/test?secret=ABCD1234",
      llave: "ABCD1234",
    });
    vi.mocked(authApi.activar2FA).mockRejectedValue({
      response: { data: { mensaje: "Código incorrecto" } },
    });
    renderConQuery();
    fireEvent.click(
      await screen.findByRole("button", { name: "Activar autenticación en dos pasos" })
    );
    fireEvent.change(await screen.findByPlaceholderText("000000"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar activación" }));
    await screen.findByText("Código incorrecto");
  });
});

describe("DosFactoresPage — flujo desactivación", () => {
  it("llama a desactivar2FA con el código ingresado", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: true,
      tieneConfiguracion: true,
      codigosRecuperacionRestantes: 10,
    });
    vi.mocked(authApi.desactivar2FA).mockResolvedValue({ mensaje: "OK" });
    renderConQuery();
    await screen.findByText("2FA activado");
    fireEvent.change(screen.getByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Desactivar 2FA" }));
    await waitFor(() =>
      expect(authApi.desactivar2FA).toHaveBeenCalledWith("123456")
    );
  });
});

describe("DosFactoresPage — códigos de recuperación (B8)", () => {
  it("tras activar muestra los 10 códigos una sola vez, con copiar y descargar", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({ uri: "otpauth://totp/test?secret=ABCD1234", llave: "ABCD1234" });
    vi.mocked(authApi.activar2FA).mockResolvedValue({ mensaje: "OK", codigosRecuperacion: CODIGOS });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Activar autenticación en dos pasos" }));
    fireEvent.change(await screen.findByPlaceholderText("000000"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar activación" }));

    const lista = await screen.findByRole("list", { name: "Códigos de recuperación" });
    expect(lista.querySelectorAll("li")).toHaveLength(10);
    expect(screen.getByRole("button", { name: /Copiar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar .txt/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ya los guardé" }));
    expect(screen.queryByText(CODIGOS[0])).not.toBeInTheDocument();
  });

  it("con 2FA activo muestra cuántos quedan y avisa cuando son pocos", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 2 });
    renderConQuery();
    expect(await screen.findByText(/Te quedan pocos códigos/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Códigos de recuperación" })).toBeInTheDocument();
  });

  it("no avisa cuando quedan suficientes", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 8 });
    renderConQuery();
    await screen.findByRole("heading", { name: "Códigos de recuperación" });
    expect(screen.queryByText(/Te quedan pocos códigos/)).not.toBeInTheDocument();
  });

  it("regenerar pide la contraseña y muestra los códigos nuevos", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 1 });
    vi.mocked(authApi.regenerarCodigosRecuperacion).mockResolvedValue({ mensaje: "OK", codigosRecuperacion: CODIGOS });
    renderConQuery();
    const generar = await screen.findByRole("button", { name: "Generar códigos nuevos" });
    expect(generar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Tu contraseña"), { target: { value: "Secreta123" } });
    fireEvent.click(generar);
    await waitFor(() => expect(authApi.regenerarCodigosRecuperacion).toHaveBeenCalledWith({ contrasena: "Secreta123" }));
    expect(await screen.findByText(CODIGOS[3])).toBeInTheDocument();
  });

  it("muestra el error si la contraseña no es correcta", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 5 });
    vi.mocked(authApi.regenerarCodigosRecuperacion).mockRejectedValue({ response: { data: { mensaje: "La contraseña o el código no son correctos." } } });
    renderConQuery();
    fireEvent.change(await screen.findByLabelText("Tu contraseña"), { target: { value: "mala" } });
    fireEvent.click(screen.getByRole("button", { name: "Generar códigos nuevos" }));
    expect(await screen.findByText("La contraseña o el código no son correctos.")).toBeInTheDocument();
  });
});

describe("DosFactoresPage — 409: 2FA ya activo en el servidor", () => {
  it("configurar con 409 muestra el mensaje y refresca el estado a 'activado'", async () => {
    vi.mocked(authApi.obtenerEstado2FA)
      .mockResolvedValueOnce({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 })
      .mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 10 });
    vi.mocked(authApi.configurar2FA).mockRejectedValue({
      response: { status: 409, data: { mensaje: "La verificación en dos pasos ya está activa." } },
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Activar autenticación en dos pasos" }));
    await screen.findByText("2FA activado");
    expect(authApi.obtenerEstado2FA).toHaveBeenCalledTimes(2);
  });

  it("activar con 409 sale del paso de QR y refresca el estado", async () => {
    vi.mocked(authApi.obtenerEstado2FA)
      .mockResolvedValueOnce({ habilitado: false, tieneConfiguracion: false, codigosRecuperacionRestantes: 0 })
      .mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 10 });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({ uri: "otpauth://totp/test?secret=ABCD1234", llave: "ABCD1234" });
    vi.mocked(authApi.activar2FA).mockRejectedValue({
      response: { status: 409, data: { mensaje: "La verificación en dos pasos ya está activa." } },
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Activar autenticación en dos pasos" }));
    fireEvent.change(await screen.findByPlaceholderText("000000"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar activación" }));
    await screen.findByText("2FA activado");
    expect(screen.queryByRole("button", { name: "Confirmar activación" })).not.toBeInTheDocument();
  });
});
