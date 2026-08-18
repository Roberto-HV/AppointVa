import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditLogPage from "./AuditLogPage";
import { adminApi } from "../../api/admin";
import type { AuditLogDto, AuditLogsRespuesta } from "../../api/admin";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../api/admin", () => ({
  adminApi: {
    obtenerAuditLogs: vi.fn(),
  },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: mockToast }),
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: (selector: (s: { usuario: { rol: string } }) => unknown) =>
    selector({ usuario: { rol: "SuperAdmin" } }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
}

function renderAuditLog() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <AuditLogPage />
    </QueryClientProvider>
  );
}

const emptyResponse: AuditLogsRespuesta = {
  datos: [],
  total: 0,
  pagina: 1,
  tamano: 50,
};

function makeLog(overrides: Partial<AuditLogDto> = {}): AuditLogDto {
  return {
    id: "log-1",
    usuarioId: "user-1",
    usuarioEmail: "user@test.com",
    accion: "Login",
    entidad: null,
    entidadId: null,
    detalles: null,
    ipAddress: "127.0.0.1",
    fechaEn: "2024-06-15T10:00:00Z",
    ...overrides,
  };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue(emptyResponse);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuditLogPage — encabezados de tabla", () => {
  it("muestra los encabezados de columna esperados", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");
    expect(screen.getByRole("columnheader", { name: /Fecha/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Acción/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Usuario/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /IP/i })).toBeInTheDocument();
  });
});

describe("AuditLogPage — estado de carga", () => {
  it("muestra 'Cargando…' mientras la consulta está pendiente", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockImplementation(
      () => new Promise(() => {})
    );
    renderAuditLog();
    expect(await screen.findByText("Cargando…")).toBeInTheDocument();
  });
});

describe("AuditLogPage — estado vacío", () => {
  it("muestra 'Sin registros' cuando no hay datos", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");
  });
});

describe("AuditLogPage — fila de datos", () => {
  it("muestra el email del usuario y la IP en la fila del log", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog()],
      total: 1,
      pagina: 1,
      tamano: 50,
    });
    renderAuditLog();
    await screen.findByText("user@test.com");
    expect(screen.getByText("127.0.0.1")).toBeInTheDocument();
  });
});

describe("AuditLogPage — filtro de acción", () => {
  it("llama a la API con el filtro de acción seleccionado", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "Login" } });

    await waitFor(() => {
      expect(adminApi.obtenerAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ accion: "Login" })
      );
    });
  });
});

describe("AuditLogPage — paginación", () => {
  it("el botón Anterior está deshabilitado en la primera página", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [],
      total: 100,
      pagina: 1,
      tamano: 50,
    });
    renderAuditLog();
    const anterior = await screen.findByRole("button", { name: "Anterior" });
    expect(anterior).toBeDisabled();
  });
});
