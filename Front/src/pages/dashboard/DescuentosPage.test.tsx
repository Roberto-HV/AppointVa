import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DescuentosPage from "./DescuentosPage";
import { descuentosApi } from "../../api/descuentos";
import type { Descuento } from "../../api/descuentos";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../api/descuentos", () => ({
  descuentosApi: {
    getDescuentos: vi.fn(),
    crear: vi.fn(),
    eliminar: vi.fn(),
  },
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: { obtenerPerfil: vi.fn().mockResolvedValue({ zonaHoraria: "America/Mexico_City" }) },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: mockToast }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeDescuento = (overrides: Partial<Descuento> = {}): Descuento => ({
  id: "1",
  codigo: "TEST10",
  tipo: "Porcentaje",
  valor: 10,
  activo: true,
  agotado: false,
  expirado: false,
  usoActual: 0,
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
      <DescuentosPage />
    </QueryClientProvider>
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([]);
  vi.mocked(descuentosApi.crear).mockResolvedValue(makeDescuento());
  vi.mocked(descuentosApi.eliminar).mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DescuentosPage — estado vacío", () => {
  it("muestra el mensaje de estado vacío cuando no hay cupones", async () => {
    renderConQuery();
    await screen.findByText("No hay cupones configurados");
  });
});

describe("DescuentosPage — lista de cupones", () => {
  it("muestra el código del cupón activo", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento()]);
    renderConQuery();
    await screen.findByText("TEST10");
  });
});

describe("DescuentosPage — formulario", () => {
  it("muestra el campo Código al abrir el formulario", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo cupón/ }));
    expect(screen.getByPlaceholderText("PROMO20")).toBeInTheDocument();
  });

  it("convierte el código a mayúsculas mientras se escribe", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo cupón/ }));
    const input = screen.getByPlaceholderText("PROMO20");
    fireEvent.change(input, { target: { value: "promo20" } });
    expect(input).toHaveValue("PROMO20");
  });

  it("el botón Crear cupón está deshabilitado con campos obligatorios vacíos", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo cupón/ }));
    expect(screen.getByRole("button", { name: /Crear cupón/ })).toBeDisabled();
  });

  it("llama a descuentosApi.crear con el payload correcto", async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo cupón/ }));

    fireEvent.change(screen.getByPlaceholderText("PROMO20"), {
      target: { value: "SAVE10" },
    });
    fireEvent.change(screen.getByPlaceholderText("20"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear cupón/ }));

    await waitFor(() => {
      expect(descuentosApi.crear).toHaveBeenCalledWith({
        codigo: "SAVE10",
        descripcion: undefined,
        tipo: "Porcentaje",
        valor: 10,
        usoMaximo: undefined,
        fechaExpiracion: undefined,
      });
    });
  });

  it("muestra un toast de error si la creación falla", async () => {
    vi.mocked(descuentosApi.crear).mockRejectedValue(new Error("fail"));

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo cupón/ }));

    fireEvent.change(screen.getByPlaceholderText("PROMO20"), {
      target: { value: "ERR10" },
    });
    fireEvent.change(screen.getByPlaceholderText("20"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear cupón/ }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.any(String), "error");
    });
  });
});

describe("DescuentosPage — eliminar cupón", () => {
  it("llama a descuentosApi.eliminar cuando el usuario confirma", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento()]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cupón TEST10" }));
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cupón" }));

    await waitFor(() => {
      expect(descuentosApi.eliminar).toHaveBeenCalledWith("1");
    });
  });

  it("no llama a descuentosApi.eliminar cuando el usuario cancela", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento()]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cupón TEST10" }));
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));

    await waitFor(() => {
      expect(descuentosApi.eliminar).not.toHaveBeenCalled();
    });
  });
});

describe("DescuentosPage — validación y expiración (OM-24)", () => {
  const abrir = async () => {
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo cupón/ }));
    return screen.getByRole("dialog", { name: "Nuevo cupón" });
  };

  it("un porcentaje mayor a 100 no llega al servidor y se explica bajo el campo", async () => {
    await abrir();
    fireEvent.change(screen.getByPlaceholderText("PROMO20"), { target: { value: "MUCHO" } });
    fireEvent.change(screen.getByPlaceholderText("20"), { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear cupón/ }));
    expect(await screen.findByText("Un porcentaje no puede pasar de 100%")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor (%)")).toHaveAttribute("aria-invalid", "true");
    expect(descuentosApi.crear).not.toHaveBeenCalled();
  });

  it("Enter en el formulario lo envía (ahora es un <form>)", async () => {
    await abrir();
    fireEvent.change(screen.getByPlaceholderText("PROMO20"), { target: { value: "ENTER5" } });
    fireEvent.change(screen.getByPlaceholderText("20"), { target: { value: "5" } });
    fireEvent.submit(screen.getByPlaceholderText("20").closest("form")!);
    await waitFor(() => expect(descuentosApi.crear).toHaveBeenCalledWith(expect.objectContaining({ codigo: "ENTER5", valor: 5 })));
  });

  it("el monto fijo se muestra con formato de precio", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento({ tipo: "MontoFijo", valor: 50 })]);
    renderConQuery();
    expect(await screen.findByText("$50.00 de descuento")).toBeInTheDocument();
  });

  it("la fecha de expiración se muestra como 'Válido hasta' en el día local correcto", async () => {
    // 05:59:59 UTC del 1 de enero = 23:59:59 del 31 de diciembre en Ciudad de México.
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([
      makeDescuento({ fechaExpiracion: "2027-01-01T05:59:59" }),
    ]);
    renderConQuery();
    expect(await screen.findByText(/Válido hasta:/)).toBeInTheDocument();
  });
});

describe("DescuentosPage — error de carga", () => {
  it("un fallo no se lee como 'no hay cupones'", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockRejectedValueOnce(new Error("red"));
    renderConQuery();
    expect(await screen.findByText("No se pudieron cargar los cupones.")).toBeInTheDocument();
    expect(screen.queryByText("No hay cupones configurados")).toBeNull();
  });
});
