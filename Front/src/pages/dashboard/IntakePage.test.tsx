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
    expect(screen.getByPlaceholderText("Sí, No, Tal vez")).toBeInTheDocument();

    fireEvent.change(tipoSelect, { target: { value: "Texto" } });
    expect(screen.queryByPlaceholderText("Sí, No, Tal vez")).not.toBeInTheDocument();
  });

  it("muestra toast de error al guardar Seleccion sin opciones", async () => {
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
    expect(mockToast).toHaveBeenCalledWith(expect.any(String), "error");
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
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(intakeApi.getCampos).mockResolvedValue([makeCampo()]);

    renderConQuery();
    await screen.findByText("Alergias");

    // Buttons: [0] Nueva pregunta, [1] Editar, [2] Eliminar
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(intakeApi.eliminarCampo).toHaveBeenCalledWith("1");
    });
  });
});
