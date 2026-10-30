import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { citasApi } from "../../api/citas";
import EmpleadosPage from "./EmpleadosPage";

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  motion: {
    div: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...(rest as object)}>{children}</div>
    ),
  },
}));

vi.mock("../../api/empleados", () => ({
  empleadosApi: {
    obtenerTodos: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
    contarCitasFuturas: vi.fn(),
    invitar: vi.fn(),
    obtenerHorario: vi.fn(),
    actualizarHorario: vi.fn(),
    obtenerBloqueos: vi.fn(),
    crearBloqueo: vi.fn(),
    eliminarBloqueo: vi.fn(),
    subirFoto: vi.fn(),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerHorarios: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../api/citas", () => ({
  citasApi: {
    obtenerTodas: vi.fn().mockResolvedValue({ datos: [], total: 0 }),
  },
  citasABusySlots: vi.fn().mockReturnValue([]),
  ESTADOS: { Pendiente: 1, Confirmada: 2, Completada: 3, Cancelada: 4, Inasistencia: 5 },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: vi.fn() }),
}));

vi.mock("../../components/ui/Modal", () => ({
  default: ({
    abierto,
    titulo,
    children,
    onCerrar,
  }: {
    abierto: boolean;
    titulo: string;
    children?: React.ReactNode;
    onCerrar?: () => void;
    ancho?: string;
  }) =>
    abierto ? (
      <div role="dialog" aria-label={titulo}>
        {onCerrar && (
          <button type="button" onClick={onCerrar}>
            Cerrar modal
          </button>
        )}
        {children}
      </div>
    ) : null,
}));

vi.mock("../../components/ui/DateTimePicker", () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="date"
      data-testid="date-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  TimePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="time"
      data-testid="time-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  citasABusySlots: vi.fn().mockReturnValue([]),
  ESTADOS: { Pendiente: 1, Confirmada: 2, Completada: 3, Cancelada: 4, Inasistencia: 5 },
}));

vi.mock("../../components/ui/Skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" className="animate-pulse" />,
  SkeletonCards: ({ cantidad }: { cantidad: number }) => (
    <div data-testid="skeleton-cards">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div key={i} className="animate-pulse" />
      ))}
    </div>
  ),
}));

import { empleadosApi } from "../../api/empleados";

const mockEmpleado = {
  id: "emp-1",
  nombre: "María García",
  telefono: "5511223344",
  email: "maria@salon.com",
  biografia: "Especialista en cabello",
  activo: true,
  servicioIds: [],
  fotoUrl: null,
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <EmpleadosPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0 } as never);
  // clearAllMocks keeps queued *Once values; a test that ends before its
  // query fires would leak them into the next test.
  vi.mocked(empleadosApi.obtenerHorario).mockReset();
  vi.mocked(empleadosApi.contarCitasFuturas).mockResolvedValue(0);
});

describe("EmpleadosPage — estado de carga", () => {
  it("muestra el skeleton mientras se obtienen los empleados", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockReturnValue(new Promise(() => {}));
    const { getByTestId } = renderConQuery();
    await waitFor(() =>
      expect(getByTestId("skeleton-cards")).toBeInTheDocument()
    );
  });
});

describe("EmpleadosPage — estado vacío", () => {
  it("muestra el estado vacío cuando no hay empleados", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Aún no tienes empleados")).toBeInTheDocument()
    );
  });

  it("muestra el botón para agregar el primer empleado en el estado vacío", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Agregar primer empleado" })
      ).toBeInTheDocument()
    );
  });
});

describe("EmpleadosPage — error de carga (G2)", () => {
  it("muestra ErrorCarga con Reintentar y no el estado vacío", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockRejectedValue(new Error("500"));
    renderConQuery();

    const alerta = await screen.findByRole("alert");
    expect(within(alerta).getByText("No se pudieron cargar los empleados.")).toBeInTheDocument();
    expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText("Aún no tienes empleados")).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar primer empleado" })).toBeNull();
  });

  it("Reintentar vuelve a pedir el equipo y lo muestra", async () => {
    vi.mocked(empleadosApi.obtenerTodos)
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue([mockEmpleado]);
    renderConQuery();

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(mockEmpleado.nombre)).toBeInTheDocument();
  });
});

describe("EmpleadosPage — lista de empleados", () => {
  it("muestra el nombre del empleado", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("María García")).toBeInTheDocument()
    );
  });

  it("muestra el badge de estado Activo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Activo")).toBeInTheDocument()
    );
  });

  it("muestra el botón '+ Nuevo empleado' en el encabezado", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo empleado" })
      ).toBeInTheDocument()
    );
  });

  it("muestra el input de búsqueda cuando hay empleados", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByPlaceholderText("Buscar por nombre...")
      ).toBeInTheDocument()
    );
  });

  // El filtrado es en memoria, pero se confirma igual que las búsquedas que van
  // al servidor: para quien usa el panel el control se comporta siempre igual.
  it("filtra empleados al confirmar la búsqueda, no al teclear", async () => {
    const otroEmpleado = { ...mockEmpleado, id: "emp-2", nombre: "Juan Pérez" };
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado, otroEmpleado]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("María García")).toBeInTheDocument()
    );
    const input = screen.getByPlaceholderText("Buscar por nombre...");
    await userEvent.type(input, "Juan");
    expect(screen.getByText("María García")).toBeInTheDocument();

    await userEvent.type(input, "{Enter}");
    await waitFor(() =>
      expect(screen.queryByText("María García")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
  });
});

describe("EmpleadosPage — modal de nuevo empleado", () => {
  it("abre el modal al hacer clic en '+ Nuevo empleado'", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo empleado" })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo empleado" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Nuevo empleado" })).toBeInTheDocument()
    );
  });

  it("el modal contiene el campo Nombre", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo empleado" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(screen.getByText("Nombre *")).toBeInTheDocument();
  });

  it("el modal contiene el campo Correo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo empleado" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(screen.getByText("Correo")).toBeInTheDocument();
  });
});

describe("EmpleadosPage — eliminar empleado", () => {
  it("llama a eliminar al confirmar en el modal de confirmación", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.eliminar).mockResolvedValue();
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("María García")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Eliminar empleado" })).toBeInTheDocument()
    );
    // El botón nombra la acción, no "Sí, eliminar". Aparece tras comprobar que no hay citas futuras.
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar empleado" }));
    await waitFor(() =>
      expect(vi.mocked(empleadosApi.eliminar)).toHaveBeenCalledWith("emp-1")
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("con citas futuras bloquea la eliminación, dice cuántas y enlaza a Citas filtradas (OM-17)", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    // B13: el conteo viene del servidor (`GET /empleados/{id}/citas-futuras`).
    vi.mocked(empleadosApi.contarCitasFuturas).mockResolvedValue(3);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    const dialogo = await screen.findByRole("dialog", { name: "No se puede eliminar todavía" });
    expect(dialogo).toHaveTextContent("Tiene 3 citas pendientes o confirmadas desde hoy");
    expect(dialogo).toHaveTextContent("Si eliges «Desactivar», esas 3 citas se mantienen en la agenda.");
    expect(empleadosApi.contarCitasFuturas).toHaveBeenCalledWith("emp-1");
    const enlace = screen.getByRole("link", { name: "Ver sus citas" });
    expect(enlace.getAttribute("href")).toContain("empleadoId=emp-1");
    expect(enlace.getAttribute("href")).toMatch(/desde=\d{4}-\d{2}-\d{2}/);
    expect(screen.queryByRole("button", { name: "Eliminar empleado" })).not.toBeInTheDocument();
    expect(empleadosApi.eliminar).not.toHaveBeenCalled();
  });
});

describe("EmpleadosPage — desactivar y reactivar (B13)", () => {
  it("pide también los empleados inactivos", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await screen.findByText("María García");
    expect(empleadosApi.obtenerTodos).toHaveBeenCalledWith(true);
  });

  it("desde el diálogo de eliminar, Desactivar es la acción principal aunque haya citas", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.contarCitasFuturas).mockResolvedValue(2);
    vi.mocked(empleadosApi.desactivar).mockResolvedValue({ ...mockEmpleado, activo: false });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    const dialogo = await screen.findByRole("dialog", { name: "No se puede eliminar todavía" });
    expect(dialogo).toHaveTextContent("perderá el acceso al panel");
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(empleadosApi.desactivar).toHaveBeenCalledWith("emp-1"));
    expect(empleadosApi.eliminar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("un empleado inactivo muestra Reactivar, que llama a la API, y su diálogo no ofrece Desactivar", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([{ ...mockEmpleado, activo: false }]);
    vi.mocked(empleadosApi.reactivar).mockResolvedValue(mockEmpleado);
    renderConQuery();
    expect(await screen.findByText("Inactivo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reactivar a María García" }));
    await waitFor(() => expect(empleadosApi.reactivar).toHaveBeenCalledWith("emp-1"));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await screen.findByRole("button", { name: "Eliminar empleado" });
    expect(screen.queryByRole("button", { name: "Desactivar" })).toBeNull();
  });

  it("un empleado activo no muestra Reactivar", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await screen.findByText("María García");
    expect(screen.queryByRole("button", { name: /Reactivar/ })).toBeNull();
  });
});

describe("EmpleadosPage — horario del empleado (OM-01)", () => {
  it("si el horario no carga, avisa, no muestra un horario por defecto y no deja guardar", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.obtenerHorario).mockRejectedValueOnce(new Error("red"));
    renderConQuery();
    await screen.findByText("María García");

    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));
    // El modal abre al instante, antes de que responda el servidor.
    expect(screen.getByRole("dialog", { name: "Horarios — María García" })).toBeInTheDocument();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el horario");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByText("Lunes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar horario" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    expect(empleadosApi.actualizarHorario).not.toHaveBeenCalled();
  });

  it("al reintentar con éxito muestra el horario real y permite guardarlo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.obtenerHorario)
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValueOnce([
        { diaSemana: 1, activo: false, intervalos: [] },
        { diaSemana: 2, activo: true, intervalos: [{ horaInicio: "10:00", horaFin: "14:00" }] },
      ]);
    vi.mocked(empleadosApi.actualizarHorario).mockResolvedValue(undefined as never);
    renderConQuery();
    await screen.findByText("María García");
    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    const lunes = await screen.findByRole("switch", { name: "Lunes" });
    expect(lunes).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("switch", { name: "Martes" })).toHaveAttribute("aria-checked", "true");

    const guardar = screen.getByRole("button", { name: "Guardar horario" });
    expect(guardar).toBeEnabled();
    fireEvent.click(guardar);
    await waitFor(() => expect(empleadosApi.actualizarHorario).toHaveBeenCalledTimes(1));
    const enviado = vi.mocked(empleadosApi.actualizarHorario).mock.calls[0][1];
    expect(enviado.find((d) => d.diaSemana === 1)?.activo).toBe(false);
    expect(enviado.find((d) => d.diaSemana === 2)?.intervalos).toEqual([{ horaInicio: "10:00", horaFin: "14:00" }]);
  });

  it("al cerrar sin cambios y reabrir el mismo empleado, vuelve a pedir el horario y deja editar", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.obtenerHorario).mockResolvedValue([
      { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "19:00" }] },
    ]);
    renderConQuery();
    await screen.findByText("María García");

    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));
    await screen.findByRole("switch", { name: "Lunes" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));
    expect(await screen.findByRole("switch", { name: "Lunes" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Guardar horario" })).toBeEnabled();
    expect(empleadosApi.obtenerHorario).toHaveBeenCalledTimes(2);
  });

  it("tras guardar y reabrir el mismo empleado con los mismos datos, deja editar", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.obtenerHorario).mockResolvedValue([
      { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "19:00" }] },
    ]);
    vi.mocked(empleadosApi.actualizarHorario).mockResolvedValue(undefined as never);
    renderConQuery();
    await screen.findByText("María García");

    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));
    await screen.findByRole("switch", { name: "Lunes" });
    fireEvent.click(screen.getByRole("button", { name: "Guardar horario" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(empleadosApi.actualizarHorario).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));
    expect(await screen.findByRole("switch", { name: "Lunes" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Guardar horario" })).toBeEnabled();
    expect(empleadosApi.obtenerHorario).toHaveBeenCalledTimes(2);
  });

  it("el día se abre y se cierra con el teclado", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.obtenerHorario).mockResolvedValue([
      { diaSemana: 1, activo: true, intervalos: [{ horaInicio: "09:00", horaFin: "19:00" }] },
    ]);
    renderConQuery();
    await screen.findByText("María García");
    fireEvent.click(screen.getByRole("button", { name: /Horarios/ }));

    const lunes = await screen.findByRole("switch", { name: "Lunes" });
    lunes.focus();
    await userEvent.keyboard(" ");
    expect(lunes).toHaveAttribute("aria-checked", "false");
  });
});

describe("EmpleadosPage — foto del empleado (OM-07)", () => {
  it("el cambio de foto es un botón con nombre", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    expect(await screen.findByRole("button", { name: "Cambiar foto de María García" })).toBeInTheDocument();
  });
});

describe("EmpleadosPage — acceso y campos (OM-23, OM-26)", () => {
  it("el botón para ver la contraseña tiene nombre y se alcanza con el teclado", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await screen.findByText("María García");
    fireEvent.click(screen.getByRole("button", { name: /Invitar/ }));
    const ver = await screen.findByRole("button", { name: "Mostrar contraseña" });
    expect(ver).not.toHaveAttribute("tabindex", "-1");
    fireEvent.click(ver);
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Contraseña inicial *")).toHaveAttribute("type", "text");
  });

  it("un campo inválido marca el error también en dark mode y lo enlaza al campo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    await screen.findByText("María García");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo/ }));
    const nombre = await screen.findByLabelText("Nombre *");
    fireEvent.submit(nombre.closest("form")!);
    await waitFor(() => expect(nombre).toHaveAttribute("aria-invalid", "true"));
    expect(nombre.className).toContain("dark:border-red-400");
    expect(nombre.className).not.toContain("dark:border-slate-600");
    expect(nombre).toHaveAccessibleDescription("Nombre requerido");
  });
});

describe("EmpleadosPage — foto con validación y avance (OM-16)", () => {
  it("rechaza un archivo que no es imagen sin subirlo", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar foto de María García" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "cv.pdf", { type: "application/pdf" })] } });
    expect(empleadosApi.subirFoto).not.toHaveBeenCalled();
  });

  it("muestra el avance en la tarjeta mientras sube", async () => {
    vi.mocked(empleadosApi.obtenerTodos).mockResolvedValue([mockEmpleado]);
    vi.mocked(empleadosApi.subirFoto).mockImplementation((_id, _f, onProgreso) => {
      onProgreso?.(30);
      return new Promise(() => {});
    });
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar foto de María García" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "f.jpg", { type: "image/jpeg" })] } });
    const barra = await screen.findByRole("progressbar", { name: "Subiendo foto de María García" });
    await waitFor(() => expect(barra).toHaveAttribute("aria-valuenow", "30"));
    expect(screen.getByRole("button", { name: "Cambiar foto de María García" })).toBeDisabled();
  });
});
