import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  tamano: 15,
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
    fechaEn: "2024-06-15T10:00:00",
    ...overrides,
  };
}

/** El filtro usa el `Select` del dashboard: botón visible + lista de opciones. */
async function elegirAccion(opcion: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Acción" }));
  await user.click(screen.getByRole("option", { name: opcion }));
}

/** La búsqueda se confirma; teclear no dispara la consulta. */
async function buscarUsuario(valor: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByRole("searchbox", { name: "Buscar por correo o ID de usuario" }));
  if (valor) {
    await user.type(screen.getByRole("searchbox", { name: "Buscar por correo o ID de usuario" }), valor);
  }
  await user.click(screen.getByRole("button", { name: "Buscar" }));
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

  it("ofrece limpiar los filtros cuando el vacío viene de un filtro", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");

    await elegirAccion("Cierre de sesión");

    expect(await screen.findByRole("button", { name: "Ver todos los eventos" })).toBeInTheDocument();
  });
});

describe("AuditLogPage — fila de datos", () => {
  it("muestra el email del usuario y la IP en la fila del log", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog()],
      total: 1,
      pagina: 1,
      tamano: 15,
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

    await elegirAccion("Inicio de sesión");

    await waitFor(() => {
      expect(adminApi.obtenerAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ accion: "Login" })
      );
    });
  });

  it("no ofrece acciones que el backend nunca registra", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");

    fireEvent.click(screen.getByRole("button", { name: "Acción" }));

    // "SubirFoto" es el nombre de dos endpoints, no un valor de AuditLog.Accion:
    // filtrar por ella devolvía siempre cero registros.
    expect(screen.queryByRole("option", { name: "SubirFoto" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Inicio de sesión" })).toBeInTheDocument();
  });
});

describe("AuditLogPage — lectura de los eventos (AP-24)", () => {
  const uuid = "3f2b8c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

  it("muestra las acciones con nombre legible, no el interno", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ accion: "LoginFallido" })], total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();
    expect(await screen.findByText("Inicio de sesión fallido")).toBeInTheDocument();
    expect(screen.queryByText("LoginFallido")).not.toBeInTheDocument();
  });

  it("los detalles completos se abren sin depender del hover y permiten filtrar por el usuario", async () => {
    const user = userEvent.setup();
    const largo = "Intento con contraseña incorrecta desde un dispositivo nuevo, tercer intento seguido";
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ usuarioId: uuid, detalles: largo })], total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();
    const boton = await screen.findByRole("button", { name: /Ver detalle/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    await user.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    const detalle = document.getElementById(boton.getAttribute("aria-controls")!)!;
    expect(detalle).toHaveTextContent(largo);
    expect(detalle).toHaveTextContent(uuid);

    await user.click(screen.getByRole("button", { name: "Ver solo los eventos de este usuario" }));
    await waitFor(() =>
      expect(adminApi.obtenerAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: uuid }))
    );
  });
});

describe("AuditLogPage — búsqueda por correo o ID de usuario (B24)", () => {
  it("un texto que no es UUID se busca como parte del correo", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");

    await buscarUsuario("ana@");

    await waitFor(() => {
      expect(adminApi.obtenerAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ email: "ana@", usuarioId: undefined })
      );
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("consulta con el UUID cuando está completo", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");

    const uuid = "3f8a1c2e-7b94-4d61-9a0f-52c6e8d4b7a3";
    await buscarUsuario(uuid);

    await waitFor(() => {
      expect(adminApi.obtenerAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: uuid, email: undefined })
      );
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ofrece un filtro de período", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");
    expect(screen.getByRole("group", { name: "Período" })).toBeInTheDocument();
  });
});

describe("AuditLogPage — paginación", () => {
  it("pide páginas de 15, el mismo tamaño que el resto del dashboard", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");
    expect(adminApi.obtenerAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ tamano: 15 })
    );
  });

  it("el botón de página anterior está deshabilitado en la primera página", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog()],
      total: 100,
      pagina: 1,
      tamano: 15,
    });
    renderAuditLog();
    const anterior = await screen.findByRole("button", { name: "Página anterior" });
    expect(anterior).toBeDisabled();
  });

  it("pide la página siguiente al avanzar", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog()],
      total: 100,
      pagina: 1,
      tamano: 15,
    });
    renderAuditLog();

    fireEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));

    await waitFor(() => {
      expect(adminApi.obtenerAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ pagina: 2 })
      );
    });
  });

  it("muestra un reintento cuando la consulta falla", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockRejectedValue(new Error("boom"));
    renderAuditLog();
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
