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
  },
}));

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
    });
    vi.mocked(authApi.configurar2FA).mockResolvedValue({
      uri: "otpauth://totp/test?secret=ABCD1234",
      llave: "ABCD1234",
    });
    vi.mocked(authApi.activar2FA).mockResolvedValue({ mensaje: "OK" });
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
});

describe("DosFactoresPage — flujo activación: código incorrecto", () => {
  it("muestra el error del servidor cuando el código es inválido", async () => {
    vi.mocked(authApi.obtenerEstado2FA).mockResolvedValue({
      habilitado: false,
      tieneConfiguracion: false,
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
