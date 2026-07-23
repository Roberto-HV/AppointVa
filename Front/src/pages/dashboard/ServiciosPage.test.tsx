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
  categoriaId: null,
  categoriaNombre: null,
  imagenUrl: null,
};

const mockCategoria = {
  id: "cat-1",
  nombre: "Cabello",
  orden: 1,
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
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
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
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Eliminar servicio" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
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
