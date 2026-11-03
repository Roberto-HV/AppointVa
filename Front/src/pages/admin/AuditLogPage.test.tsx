import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuditLogPage from "./AuditLogPage";
import { adminApi } from "../../api/admin";
import type { AuditLogDto, AuditLogsRespuesta, CatalogoAuditoria } from "../../api/admin";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../api/admin", () => ({
  adminApi: {
    obtenerAuditLogs: vi.fn(),
    obtenerCatalogoAuditoria: vi.fn(),
  },
}));

/** Extracto del catálogo que sirve el backend (`AccionesAuditoria`). */
const catalogo: CatalogoAuditoria = {
  grupos: [
    { id: "acceso", etiqueta: "Inicios de sesión" },
    { id: "cuenta", etiqueta: "Cuenta y seguridad" },
    { id: "kiosco", etiqueta: "Recepción (kiosco)" },
    { id: "administracion", etiqueta: "Administración" },
  ],
  acciones: [
    { accion: "Login", etiqueta: "Inicio de sesión", grupo: "acceso" },
    { accion: "LoginFallido", etiqueta: "Inicio de sesión fallido", grupo: "acceso" },
    { accion: "Logout", etiqueta: "Cierre de sesión", grupo: "acceso" },
    { accion: "2FAActivado", etiqueta: "Verificación en dos pasos activada", grupo: "cuenta" },
    { accion: "CodigoRecuperacionUsado", etiqueta: "Código de recuperación usado", grupo: "cuenta" },
    { accion: "KioscoSalida", etiqueta: "Salida del kiosco", grupo: "kiosco" },
    { accion: "NegocioEliminado", etiqueta: "Negocio eliminado", grupo: "administracion" },
    { accion: "PlanCambiado", etiqueta: "Plan cambiado", grupo: "administracion" },
  ],
};

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
async function elegir(filtro: string, opcion: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: filtro }));
  await user.click(await screen.findByRole("option", { name: opcion }));
}

const elegirAccion = (opcion: string) => elegir("Acción", opcion);

/** La búsqueda es en vivo; Enter la aplica sin esperar la pausa al teclear. */
async function buscarUsuario(valor: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByRole("searchbox", { name: "Buscar por correo o ID de usuario" }));
  if (valor) {
    await user.type(screen.getByRole("searchbox", { name: "Buscar por correo o ID de usuario" }), valor);
  }
  await user.keyboard("{Enter}");
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue(emptyResponse);
  vi.mocked(adminApi.obtenerCatalogoAuditoria).mockResolvedValue(catalogo);
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

describe("AuditLogPage — estado de carga (Lote 3, I5)", () => {
  it("muestra el skeleton de la lista, no un 'Cargando…' en texto", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockImplementation(
      () => new Promise(() => {})
    );
    renderAuditLog();
    const carga = await screen.findByRole("status", { name: "Cargando registro de auditoría" });
    // Tarjetas en el teléfono y filas en escritorio, como las listas del panel.
    expect(carga.querySelector('[data-variante="tarjetas"]')).not.toBeNull();
    expect(carga.querySelector('[data-variante="filas"]')).not.toBeNull();
    expect(screen.queryByText("Cargando…")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("AuditLogPage — error de carga (Lote 3, I5)", () => {
  it("usa ErrorCarga con su mensaje y 'Reintentar' vuelve a pedir el registro", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockRejectedValue(new Error("boom"));
    renderAuditLog();
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("No se pudo cargar el registro de auditoría.");
    expect(alerta).toHaveTextContent("Revisa tu conexión e intenta de nuevo.");
    // Sin tabla vacía detrás del error: un fallo no se lee como "sin registros".
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({ datos: [makeLog()], total: 1, pagina: 1, tamano: 15 });
    fireEvent.click(within(alerta).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("user@test.com")).toBeInTheDocument();
  });
});

describe("AuditLogPage — tarjetas en el teléfono (Lote 3, I6)", () => {
  function simularTelefono() {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q.includes("max-width: 639.98px"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }
  afterEach(() => vi.unstubAllGlobals());

  it("debajo de sm cada evento es una tarjeta con acción, fecha, usuario y negocio a la vista", async () => {
    simularTelefono();
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ accion: "PlanCambiado", entidad: "Negocio", negocioNombre: "Estética Luna", usuarioEmail: "un.correo.bastante.largo@appointva.com" })],
      total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();

    const lista = await screen.findByRole("list", { name: "Eventos" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const [tarjeta] = within(lista).getAllByRole("listitem");
    expect(await within(tarjeta).findByText("Plan cambiado")).toBeInTheDocument();
    expect(within(tarjeta).getByText("un.correo.bastante.largo@appointva.com")).toBeInTheDocument();
    expect(within(tarjeta).getByText("Estética Luna")).toBeInTheDocument();
    expect(within(tarjeta).getByText(/15 jun 2024/)).toBeInTheDocument();
  });

  it("el detalle se abre dentro de la tarjeta, con la fecha exacta y la IP", async () => {
    simularTelefono();
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ ipAddress: "::1", fechaEn: "2024-06-15T10:00:42" })], total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();
    fireEvent.click(await screen.findByRole("button", { name: /Ver detalle/ }));
    const detalle = document.getElementById("detalle-log-1")!;
    expect(detalle).toHaveTextContent("::1");
    expect(detalle).toHaveTextContent(/10:00:42/);
  });

  it("sin eventos, la tarjeta muestra el vacío", async () => {
    simularTelefono();
    renderAuditLog();
    expect(await screen.findByText("Sin registros")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
    // M8: la IP del propio equipo se lee "Local"; la dirección queda en el title.
    expect(screen.getByText("Local")).toHaveAttribute("title", "127.0.0.1");
  });

  it("una IP externa se muestra tal cual", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ ipAddress: "189.203.10.4" })], total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();
    expect(await screen.findByText("189.203.10.4")).toBeInTheDocument();
  });

  it("la fecha usa el formato corto compartido, sin segundos (M3)", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ fechaEn: "2024-06-15T10:00:42" })], total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();
    const celda = await screen.findByText(/15 jun 2024/);
    expect(celda.textContent).toMatch(/10:00/);
    expect(celda.textContent).not.toMatch(/10:00:42/);
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
    // En la tabla: el filtro "Acción" también lista la etiqueta.
    const tabla = await screen.findByRole("table");
    expect(await within(tabla).findByText("Inicio de sesión fallido")).toBeInTheDocument();
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

describe("AuditLogPage — catálogo de acciones del backend (Lote 1, G2)", () => {
  it("el filtro 'Acción' lista todo lo que el backend escribe, también 2FA y kiosco", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");
    await waitFor(() => expect(adminApi.obtenerCatalogoAuditoria).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: "Acción" }));

    const opciones = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Todas las acciones", ...catalogo.acciones.map((a) => a.etiqueta)]);
  });

  it("'Administración' filtra por grupo y deja en 'Acción' solo las de ese grupo", async () => {
    renderAuditLog();
    await screen.findByText("Sin registros");

    await elegir("Tipo", "Administración");

    await waitFor(() =>
      expect(adminApi.obtenerAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ grupo: "administracion" }))
    );
    fireEvent.click(screen.getByRole("button", { name: "Acción" }));
    const opciones = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opciones).toEqual(["Todas las acciones", "Negocio eliminado", "Plan cambiado"]);
  });

  it("muestra la acción del admin con nombre legible y el negocio afectado", async () => {
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [
        makeLog({ id: "a", accion: "PlanCambiado", entidad: "Negocio", entidadId: "n-1", negocioNombre: "Estética Luna", detalles: "Plan: Basico → Pro" }),
        makeLog({ id: "b", accion: "NegocioEliminado", entidad: "Negocio", entidadId: "n-2", negocioNombre: null, detalles: "Nombre: Demo borrado" }),
        makeLog({ id: "c", accion: "2FAActivado", entidad: "Usuario", entidadId: "user-1" }),
      ],
      total: 3, pagina: 1, tamano: 15,
    });
    renderAuditLog();

    const tabla = await screen.findByRole("table");
    expect(await within(tabla).findByText("Plan cambiado")).toBeInTheDocument();
    expect(within(tabla).getByText("Estética Luna")).toBeInTheDocument();
    // El negocio ya no existe: se dice, y su nombre queda en los detalles.
    expect(within(tabla).getByText("Negocio que ya no existe")).toBeInTheDocument();
    expect(within(tabla).getByText("Verificación en dos pasos activada")).toBeInTheDocument();
    expect(screen.queryByText("PlanCambiado")).not.toBeInTheDocument();
    expect(screen.queryByText("2FAActivado")).not.toBeInTheDocument();
  });

  it("si el catálogo no llega, la tabla sigue mostrando los eventos con el nombre interno", async () => {
    vi.mocked(adminApi.obtenerCatalogoAuditoria).mockRejectedValue(new Error("caído"));
    vi.mocked(adminApi.obtenerAuditLogs).mockResolvedValue({
      datos: [makeLog({ accion: "KioscoSalida" })], total: 1, pagina: 1, tamano: 15,
    });
    renderAuditLog();
    expect(await screen.findByText("KioscoSalida")).toBeInTheDocument();
    expect(screen.getByText("user@test.com")).toBeInTheDocument();
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
