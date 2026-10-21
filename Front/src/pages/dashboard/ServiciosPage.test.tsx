import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ServiciosPage from "./ServiciosPage";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <div {...(rest as object)}>{children}</div>
    ),
  },
}));

vi.mock("../../api/servicios", () => ({
  serviciosApi: {
    obtenerTodos: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
    subirImagen: vi.fn(),
    toggleActivo: vi.fn(),
    toggleDestacado: vi.fn(),
  },
  categoriasApi: {
    obtenerTodas: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
  },
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: vi.fn() }),
}));

vi.mock("../../components/ui/Modal", () => ({
  default: ({
    abierto,
    titulo,
    children,
  }: {
    abierto: boolean;
    titulo: string;
    children?: React.ReactNode;
    onCerrar?: () => void;
    ancho?: string;
  }) =>
    abierto ? (
      <div role="dialog" aria-label={titulo}>
        {children}
      </div>
    ) : null,
}));

vi.mock("../../components/ui/Select", () => ({
  default: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <select {...(props as object)}>{children}</select>
  ),
}));

import { serviciosApi, categoriasApi } from "../../api/servicios";

const mockServicio = {
  id: "svc-1",
  nombre: "Corte de cabello",
  descripcion: "Corte clásico",
  duracionMinutos: 30,
  bufferMinutos: 0,
  precio: 200,
  orden: 1,
  activo: true,
  destacado: false,
  categoriaId: null,
  categoriaNombre: null,
  imagenUrl: null,
};

const mockCategoria = {
  id: "cat-1",
  nombre: "Cabello",
  orden: 1,
  activo: true,
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ServiciosPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoriasApi.obtenerTodas).mockResolvedValue([]);
});

describe("ServiciosPage — estado de carga", () => {
  it("muestra texto de carga mientras se obtienen los servicios", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Cargando servicios...")).toBeInTheDocument()
    );
  });
});

describe("ServiciosPage — estado vacío", () => {
  it("muestra el estado vacío cuando no hay servicios", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Aún no tienes servicios")).toBeInTheDocument()
    );
  });

  it("muestra el botón para crear el primer servicio en el estado vacío", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Crear primer servicio" })
      ).toBeInTheDocument()
    );
  });
});

describe("ServiciosPage — lista de servicios", () => {
  it("muestra el nombre del servicio", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("Corte de cabello")).toBeInTheDocument()
    );
  });

  it("muestra la duración del servicio en minutos", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByText("30 min")).toBeInTheDocument()
    );
  });

  it("muestra el botón '+ Nuevo servicio' en el encabezado", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo servicio" })
      ).toBeInTheDocument()
    );
  });

  it("muestra botones de Editar y Eliminar para cada servicio", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Editar Corte de cabello" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Eliminar Corte de cabello" })).toBeInTheDocument();
    });
  });
});

describe("ServiciosPage — modal de nuevo servicio", () => {
  it("abre el modal al hacer clic en '+ Nuevo servicio'", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo servicio" })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo servicio" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Nuevo servicio" })).toBeInTheDocument()
    );
  });

  it("el modal de nuevo servicio contiene el campo Nombre", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "+ Nuevo servicio" })
      ).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo servicio" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    );
    expect(screen.getByText("Nombre *")).toBeInTheDocument();
  });
});

describe("ServiciosPage — eliminar servicio", () => {
  it("llama a eliminar al confirmar en el modal de confirmación", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    vi.mocked(serviciosApi.eliminar).mockResolvedValue();
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar Corte de cabello" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Corte de cabello" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Eliminar servicio" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar servicio" }));
    await waitFor(() =>
      expect(vi.mocked(serviciosApi.eliminar)).toHaveBeenCalledWith("svc-1")
    );
  });
});

describe("ServiciosPage — tab Categorías", () => {
  it("muestra el estado vacío de categorías al cambiar de tab", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    vi.mocked(categoriasApi.obtenerTodas).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Categorías" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Categorías" }));
    await waitFor(() =>
      expect(screen.getByText("Aún no tienes categorías")).toBeInTheDocument()
    );
  });

  it("muestra la lista de categorías con sus nombres", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    vi.mocked(categoriasApi.obtenerTodas).mockResolvedValue([mockCategoria]);
    renderConQuery();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Categorías/ })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /Categorías/ }));
    await waitFor(() =>
      expect(screen.getByText("Cabello")).toBeInTheDocument()
    );
  });
});

describe("ServiciosPage — precio y campos numéricos (OM-05)", () => {
  function llenarNombre() {
    const nombre = document.querySelector<HTMLInputElement>('input[name="nombre"]')!;
    fireEvent.change(nombre, { target: { value: "Manicure" } });
  }

  it("acepta un precio con centavos ($149.90)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    vi.mocked(serviciosApi.crear).mockResolvedValue({} as never);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo servicio" }));
    await screen.findByRole("dialog", { name: "Nuevo servicio" });
    llenarNombre();

    const precio = screen.getByLabelText("Precio (MXN) *");
    expect(precio).toHaveAttribute("step", "0.01");
    fireEvent.change(precio, { target: { value: "149.90" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear servicio" }));

    await waitFor(() => expect(serviciosApi.crear).toHaveBeenCalledTimes(1));
    expect(vi.mocked(serviciosApi.crear).mock.calls[0][0]).toMatchObject({ nombre: "Manicure", precio: 149.9 });
  });

  it("muestra el mensaje de cada campo numérico inválido y no guarda", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo servicio" }));
    await screen.findByRole("dialog", { name: "Nuevo servicio" });
    llenarNombre();

    fireEvent.change(screen.getByLabelText("Duración (min) *"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/Buffer/), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Precio (MXN) *"), { target: { value: "10.555" } });
    fireEvent.change(screen.getByLabelText("Orden"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear servicio" }));

    expect(await screen.findByText("Mínimo 5 minutos")).toBeInTheDocument();
    expect(screen.getByText("Máximo 120 minutos")).toBeInTheDocument();
    expect(screen.getByText("Usa como máximo dos decimales (centavos)")).toBeInTheDocument();
    expect(screen.getByText("El orden empieza en 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Precio (MXN) *")).toHaveAttribute("aria-invalid", "true");
    expect(serviciosApi.crear).not.toHaveBeenCalled();
  });

  it("el formulario no usa la validación nativa del navegador", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo servicio" }));
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo servicio" });
    expect(dialogo.querySelector("form")).toHaveAttribute("novalidate");
  });
});

describe("ServiciosPage — imagen del servicio (OM-07)", () => {
  it("cambiar la imagen es un botón con el nombre del servicio", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    expect(await screen.findByRole("button", { name: "Cambiar imagen de Corte de cabello" })).toBeInTheDocument();
  });
});

describe("ServiciosPage — visibilidad y destacado (OM-30)", () => {
  it("la visibilidad es un interruptor con nombre de acción y el destacado anuncia su estado", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    const sw = await screen.findByRole("switch", { name: "Visible en reservas: Corte de cabello" });
    expect(sw).toHaveAttribute("aria-checked", String(mockServicio.activo));
    expect(screen.getByRole("button", { name: "Destacado: Corte de cabello" })).toHaveAttribute(
      "aria-pressed", String(!!mockServicio.destacado),
    );
  });

  it("una petición en curso solo bloquea la fila de ese servicio", async () => {
    const otro = { ...mockServicio, id: "svc-2", nombre: "Barba" };
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio, otro]);
    vi.mocked(serviciosApi.toggleDestacado).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Destacado: Corte de cabello" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Destacado: Corte de cabello" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Destacado: Barba" })).toBeEnabled();
  });

  it("al eliminar sugiere ocultarlo como alternativa reversible (OM-17)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([{ ...mockServicio, activo: true }]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar Corte de cabello" }));
    expect(await screen.findByText(/apaga "Visible en reservas"/)).toBeInTheDocument();
  });
});

describe("ServiciosPage — imagen del servicio (OM-16)", () => {
  it("no sube un archivo que excede el límite", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    fireEvent.click(await screen.findByRole("button", { name: "Cambiar imagen de Corte de cabello" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const grande = new File(["x"], "g.jpg", { type: "image/jpeg" });
    Object.defineProperty(grande, "size", { value: 30 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [grande] } });
    expect(serviciosApi.subirImagen).not.toHaveBeenCalled();
  });
});

describe("ServiciosPage — error de carga", () => {
  it("un fallo no se lee como catálogo vacío y se puede reintentar", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockRejectedValueOnce(new Error("red"));
    renderConQuery();
    expect(await screen.findByText("No se pudieron cargar los servicios.")).toBeInTheDocument();
    expect(screen.queryByText(/Aún no tienes/)).toBeNull();
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Corte de cabello")).toBeInTheDocument();
  });
});
