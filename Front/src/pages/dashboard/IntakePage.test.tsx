import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import IntakePage from "./IntakePage";
import { intakeApi } from "../../api/intake";
import type { CampoIntake } from "../../api/intake";
import { serviciosApi } from "../../api/servicios";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../api/intake", () => ({
  intakeApi: {
    getCampos: vi.fn(),
    crearCampo: vi.fn(),
    actualizarCampo: vi.fn(),
    eliminarCampo: vi.fn(),
    reordenar: vi.fn(),
    getRespuestas: vi.fn(),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn(),
  },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: mockToast }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeCampo = (overrides: Partial<CampoIntake> = {}): CampoIntake => ({
  id: "1",
  etiqueta: "Alergias",
  tipo: "Texto",
  requerido: false,
  orden: 1,
  ...overrides,
});

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <IntakePage />
    </QueryClientProvider>
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(intakeApi.getCampos).mockResolvedValue([]);
  vi.mocked(intakeApi.crearCampo).mockResolvedValue(makeCampo());
  vi.mocked(intakeApi.actualizarCampo).mockResolvedValue(makeCampo());
  vi.mocked(intakeApi.eliminarCampo).mockResolvedValue({} as never);
  vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IntakePage — estado vacío", () => {
  it("muestra el mensaje de estado vacío cuando no hay campos", async () => {
    renderConQuery();
    await screen.findByText("No hay preguntas configuradas");
  });
});

describe("IntakePage — formulario", () => {
  it("muestra el campo Etiqueta al abrir el formulario", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));
    expect(
      screen.getByPlaceholderText("Ej: ¿Tienes alguna alergia?")
    ).toBeInTheDocument();
  });

  it("el botón Crear pregunta está deshabilitado cuando la etiqueta está vacía", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));
    expect(screen.getByRole("button", { name: /Crear pregunta/ })).toBeDisabled();
  });

  it("tipo Seleccion muestra el campo Opciones y lo oculta al volver a Texto", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));

    // The tipo select defaults to "Texto corto" (value="Texto")
    const tipoSelect = screen.getByDisplayValue("Texto corto");

    fireEvent.change(tipoSelect, { target: { value: "Seleccion" } });
    expect(screen.getByPlaceholderText("Opción 1")).toBeInTheDocument();

    fireEvent.change(tipoSelect, { target: { value: "Texto" } });
    expect(screen.queryByPlaceholderText("Opción 1")).not.toBeInTheDocument();
  });

  it("avisa bajo el campo al guardar Seleccion sin opciones", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));

    fireEvent.change(screen.getByPlaceholderText("Ej: ¿Tienes alguna alergia?"), {
      target: { value: "Tipo de piel" },
    });

    fireEvent.change(screen.getByDisplayValue("Texto corto"), {
      target: { value: "Seleccion" },
    });

    // Opciones field is now visible but empty — click guardar
    fireEvent.click(screen.getByRole("button", { name: /Crear pregunta/ }));

    expect(intakeApi.crearCampo).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Agrega al menos una opción.");
  });

  it("llama a intakeApi.crearCampo con el payload correcto para tipo Texto", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));

    fireEvent.change(screen.getByPlaceholderText("Ej: ¿Tienes alguna alergia?"), {
      target: { value: "Alergias" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear pregunta/ }));

    await waitFor(() => {
      expect(intakeApi.crearCampo).toHaveBeenCalledWith({
        etiqueta: "Alergias",
        tipo: "Texto",
        opciones: undefined,
        requerido: false,
        servicioId: undefined,
      });
    });
  });
});

describe("IntakePage — lista de campos", () => {
  it("renderiza un campo existente", async () => {
    vi.mocked(intakeApi.getCampos).mockResolvedValue([makeCampo()]);
    renderConQuery();
    await screen.findByText("Alergias");
  });
});

describe("IntakePage — eliminar campo", () => {
  it("llama a intakeApi.eliminarCampo cuando el usuario confirma", async () => {
    vi.mocked(intakeApi.getCampos).mockResolvedValue([makeCampo()]);

    renderConQuery();
    await screen.findByText("Alergias");

    // Buttons: [0] Nueva pregunta, [1] Editar, [2] Eliminar
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(intakeApi.eliminarCampo).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar pregunta" }));

    await waitFor(() => {
      expect(intakeApi.eliminarCampo).toHaveBeenCalledWith("1");
    });
  });
});

describe("IntakePage — editor de opciones y acciones (OM-25)", () => {
  it("una opción con coma se guarda como una sola opción", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));
    fireEvent.change(screen.getByPlaceholderText("Ej: ¿Tienes alguna alergia?"), { target: { value: "¿Alergias?" } });
    fireEvent.change(screen.getByDisplayValue("Texto corto"), { target: { value: "Seleccion" } });
    fireEvent.change(screen.getByLabelText("Opción 1"), { target: { value: "Sí, pero leve" } });
    fireEvent.change(screen.getByLabelText("Opción 2"), { target: { value: "No" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar opción" }));
    expect(screen.getByLabelText("Opción 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Crear pregunta/ }));
    await waitFor(() =>
      expect(intakeApi.crearCampo).toHaveBeenCalledWith(expect.objectContaining({ opciones: '["Sí, pero leve","No"]' })),
    );
  });

  it("al editar una pregunta antigua separa sus opciones por coma", async () => {
    vi.mocked(intakeApi.getCampos).mockResolvedValue([makeCampo({ tipo: "Seleccion", opciones: "Sí, No" })]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: 'Editar pregunta "Alergias"' }));
    expect(screen.getByLabelText("Opción 1")).toHaveValue("Sí");
    expect(screen.getByLabelText("Opción 2")).toHaveValue("No");
  });

  it("las acciones tienen nombre y 'Obligatoria' no usa el rojo de error", async () => {
    vi.mocked(intakeApi.getCampos).mockResolvedValue([makeCampo({ requerido: true })]);
    renderConQuery();
    expect(await screen.findByRole("button", { name: 'Eliminar pregunta "Alergias"' })).toBeInTheDocument();
    const insignia = screen.getByText("Obligatoria");
    expect(insignia.className).not.toMatch(/red/);
  });

  it("muestra una vista previa de la pregunta", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva pregunta/ }));
    fireEvent.change(screen.getByPlaceholderText("Ej: ¿Tienes alguna alergia?"), { target: { value: "¿Color favorito?" } });
    expect(screen.getByRole("region", { name: "Vista previa" })).toHaveTextContent("¿Color favorito?");
  });
});
