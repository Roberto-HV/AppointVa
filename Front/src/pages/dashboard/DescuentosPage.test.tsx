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
    actualizar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
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
  vi.mocked(descuentosApi.actualizar).mockResolvedValue(makeDescuento());
  vi.mocked(descuentosApi.desactivar).mockResolvedValue({} as never);
  vi.mocked(descuentosApi.reactivar).mockResolvedValue(makeDescuento());
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

describe("DescuentosPage — desactivar y reactivar (B14)", () => {
  it("pide también los cupones inactivos", async () => {
    renderConQuery();
    await screen.findByText("No hay cupones configurados");
    expect(descuentosApi.getDescuentos).toHaveBeenCalledWith(true);
  });

  it("llama a descuentosApi.desactivar cuando el usuario confirma", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento()]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar cupón TEST10" }));
    expect(await screen.findByText(/podrás reactivarlo cuando quieras/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar cupón" }));

    await waitFor(() => {
      expect(descuentosApi.desactivar).toHaveBeenCalledWith("1");
    });
  });

  it("no llama a descuentosApi.desactivar cuando el usuario vuelve", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento()]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Desactivar cupón TEST10" }));
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));

    await waitFor(() => {
      expect(descuentosApi.desactivar).not.toHaveBeenCalled();
    });
  });

  it("un cupón desactivado sale en Inactivos con Reactivar, que llama a la API", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento({ activo: false })]);

    renderConQuery();
    expect(await screen.findByText("Desactivado")).toBeInTheDocument();
    expect(screen.getByText(/Inactivos, agotados o expirados/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar cupón TEST10" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reactivar cupón TEST10" }));

    await waitFor(() => expect(descuentosApi.reactivar).toHaveBeenCalledWith("1"));
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith("Cupón reactivado"));
  });

  it("si el servidor rechaza la reactivación, muestra su mensaje", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento({ activo: false })]);
    vi.mocked(descuentosApi.reactivar).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { mensaje: "Ya hay otro cupón activo con ese código." } },
    });

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Reactivar cupón TEST10" }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.stringContaining("otro cupón activo"), "error"));
  });
});

describe("DescuentosPage — editar cupón (B16)", () => {
  it("abre el formulario con los datos del cupón y guarda con actualizar", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([
      makeDescuento({ descripcion: "Bienvenida", usoMaximo: 10, usoActual: 2 }),
    ]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Editar cupón TEST10" }));
    expect(screen.getByRole("dialog", { name: "Editar cupón" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("PROMO20")).toHaveValue("TEST10");
    expect(screen.getByPlaceholderText("Descuento de bienvenida")).toHaveValue("Bienvenida");
    expect(screen.getByText(/Ya se usó 2 veces\./)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("20"), { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => {
      expect(descuentosApi.actualizar).toHaveBeenCalledWith("1", {
        codigo: "TEST10",
        descripcion: "Bienvenida",
        tipo: "Porcentaje",
        valor: 15,
        usoMaximo: 10,
        fechaExpiracion: undefined,
      });
    });
    expect(descuentosApi.crear).not.toHaveBeenCalled();
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith("Cupón actualizado"));
  });

  it("no deja bajar el límite por debajo de los usos ya hechos", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento({ usoMaximo: 10, usoActual: 4 })]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Editar cupón TEST10" }));
    fireEvent.change(screen.getByPlaceholderText("Sin límite"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    expect(await screen.findByText("Ya se usó 4 veces: el límite no puede ser menor")).toBeInTheDocument();
    expect(descuentosApi.actualizar).not.toHaveBeenCalled();
  });

  it("una fecha ya vencida que no se tocó no impide guardar y se reenvía igual", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([
      makeDescuento({ fechaExpiracion: "2020-01-02T05:59:59", expirado: true }),
    ]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Editar cupón TEST10" }));
    fireEvent.change(screen.getByPlaceholderText("Descuento de bienvenida"), { target: { value: "Vieja" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    await waitFor(() => {
      expect(descuentosApi.actualizar).toHaveBeenCalledWith("1", expect.objectContaining({
        descripcion: "Vieja",
        fechaExpiracion: "2020-01-02T05:59:59",
      }));
    });
  });

  it("después de editar, Nuevo cupón abre un formulario vacío", async () => {
    vi.mocked(descuentosApi.getDescuentos).mockResolvedValue([makeDescuento()]);

    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Editar cupón TEST10" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: /Nuevo cupón/ }));

    expect(await screen.findByRole("dialog", { name: "Nuevo cupón" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("PROMO20")).toHaveValue("");
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
    expect(await screen.findByText("$50 de descuento")).toBeInTheDocument();
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
