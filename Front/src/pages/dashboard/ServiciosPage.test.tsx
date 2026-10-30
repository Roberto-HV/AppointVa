import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ServiciosPage from "./ServiciosPage";

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
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
    cambiarOrden: vi.fn(),
    contarCitasFuturas: vi.fn(),
  },
  categoriasApi: {
    obtenerTodas: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn(),
  },
}));

vi.mock("../../api/citas", () => ({
  citasApi: { obtenerTodas: vi.fn().mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 500 }) },
  ESTADOS: { Pendiente: 1, Confirmada: 2, Completada: 3, Cancelada: 4, Inasistencia: 5 },
}));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: toastMock }),
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
import { citasApi } from "../../api/citas";

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
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ServiciosPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

/** Destacado, mover y Eliminar viven en el menú "⋯" de la fila (I9). */
async function abrirMenu(servicio = "Corte de cabello") {
  fireEvent.click(await screen.findByRole("button", { name: `Más acciones de ${servicio}` }));
  return screen.findByRole("dialog", { name: `Más acciones de ${servicio}` });
}
async function elegirDelMenu(accion: string | RegExp, servicio = "Corte de cabello") {
  const menu = await abrirMenu(servicio);
  fireEvent.click(within(menu).getByRole("button", { name: accion }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(citasApi.obtenerTodas).mockResolvedValue({ datos: [], total: 0, pagina: 1, tamano: 500 });
  vi.mocked(serviciosApi.contarCitasFuturas).mockResolvedValue(0);
  vi.mocked(categoriasApi.obtenerTodas).mockResolvedValue([]);
});

describe("ServiciosPage — estado de carga", () => {
  it("muestra filas de carga con la forma de la fila de servicio (I14)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    expect(await screen.findByRole("status", { name: "Cargando servicios" })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-variante="fila-servicio"]').length).toBeGreaterThan(0);
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

  it("deja Editar a la vista y lleva Destacado y Eliminar al menú ⋯ (I9)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    expect(await screen.findByRole("button", { name: "Editar Corte de cabello" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Visible en reservas: Corte de cabello" })).toBeInTheDocument();
    // Fuera de la fila: ni Eliminar ni Destacado como botones sueltos.
    expect(screen.queryByRole("button", { name: /^Eliminar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Destacado/ })).toBeNull();

    const menu = await abrirMenu();
    const acciones = within(menu).getAllByRole("button").map((b) => b.textContent).filter(Boolean);
    expect(acciones).toEqual(["Marcar como destacado", "Eliminar servicio"]);
    // La destructiva va al final, separada y en rojo.
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Eliminar servicio" }).className).toContain("text-red-700");
  });

  it("con varios servicios en la categoría, el menú permite moverlos (M11)", async () => {
    const otro = { ...mockServicio, id: "svc-2", nombre: "Barba", orden: 2 };
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([{ ...mockServicio, orden: 1 }, otro]);
    vi.mocked(serviciosApi.cambiarOrden).mockResolvedValue({} as never);
    renderConQuery();
    const primero = await abrirMenu("Corte de cabello");
    expect(within(primero).queryByRole("button", { name: "Mover arriba" })).toBeNull();
    fireEvent.click(within(primero).getByRole("button", { name: "Mover abajo" }));
    await waitFor(() => expect(serviciosApi.cambiarOrden).toHaveBeenCalledTimes(2));
    expect(serviciosApi.cambiarOrden).toHaveBeenCalledWith(expect.objectContaining({ id: "svc-2" }), 1);
    expect(serviciosApi.cambiarOrden).toHaveBeenCalledWith(expect.objectContaining({ id: "svc-1" }), 2);
  });
});

describe("ServiciosPage — reorden pendiente (M11)", () => {
  const a = { ...mockServicio, id: "svc-a", nombre: "Corte de cabello", orden: 1 };
  const b = { ...mockServicio, id: "svc-b", nombre: "Barba", orden: 2 };
  const c = { ...mockServicio, id: "svc-c", nombre: "Tinte", orden: 3 };

  /** Nombres de las filas en el orden en que se ven. */
  const ordenVisible = () =>
    screen.getAllByRole("button", { name: /^Editar / }).map((el) => el.getAttribute("aria-label")!.replace("Editar ", ""));

  /** Fila (destino del arrastre) y asa (origen) de un servicio. */
  function filaDe(nombre: string) {
    // La fila es el ancestro más cercano del botón Editar que también contiene el asa.
    let fila = screen.getByRole("button", { name: `Editar ${nombre}` }).parentElement!;
    while (!fila.querySelector('[title="Arrastra para cambiar el orden"]')) fila = fila.parentElement!;
    const asa = fila.querySelector('[title="Arrastra para cambiar el orden"]') as HTMLElement;
    return { fila, asa };
  }
  function arrastrar(origen: string, destino: string) {
    const dataTransfer = { setData: vi.fn(), getData: vi.fn(), effectAllowed: "" };
    fireEvent.dragStart(filaDe(origen).asa, { dataTransfer });
    fireEvent.dragOver(filaDe(destino).fila, { dataTransfer });
    fireEvent.drop(filaDe(destino).fila, { dataTransfer });
  }

  it("un segundo arrastre mientras el primero se guarda se ignora", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([a, b, c]);
    // El primer PUT nunca responde: el reorden queda pendiente.
    vi.mocked(serviciosApi.cambiarOrden).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    await screen.findByText("Tinte");

    arrastrar("Tinte", "Corte de cabello");
    await waitFor(() => expect(ordenVisible()).toEqual(["Tinte", "Corte de cabello", "Barba"]));
    expect(serviciosApi.cambiarOrden).toHaveBeenCalledTimes(1);

    arrastrar("Barba", "Tinte");
    expect(ordenVisible()).toEqual(["Tinte", "Corte de cabello", "Barba"]);
    expect(serviciosApi.cambiarOrden).toHaveBeenCalledTimes(1);
  });

  it("si el guardado falla, la lista vuelve a como estaba y avisa", async () => {
    // La carga inicial responde; el refetch posterior queda pendiente, así que lo
    // que se vea después del error solo puede venir de la reversión.
    vi.mocked(serviciosApi.obtenerTodos)
      .mockResolvedValueOnce([a, b])
      .mockReturnValue(new Promise(() => {}));
    vi.mocked(serviciosApi.cambiarOrden).mockRejectedValue(new Error("500"));
    renderConQuery();
    await elegirDelMenu("Mover abajo");

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith("No se pudo cambiar el orden. Intenta de nuevo.", "error")
    );
    expect(ordenVisible()).toEqual(["Corte de cabello", "Barba"]);
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
    await elegirDelMenu("Eliminar servicio");
    // Elegirlo en el menú no borra: abre la confirmación de siempre.
    const confirmacion = await screen.findByRole("dialog", { name: "Eliminar servicio" });
    expect(serviciosApi.eliminar).not.toHaveBeenCalled();
    fireEvent.click(await within(confirmacion).findByRole("button", { name: "Eliminar servicio" }));
    await waitFor(() =>
      expect(vi.mocked(serviciosApi.eliminar)).toHaveBeenCalledWith("svc-1")
    );
  });

  it("con citas futuras del servicio bloquea la eliminación y muestra cuántas (OM-17)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    // B13: el conteo viene del servidor (`GET /servicios/{id}/citas-futuras`).
    vi.mocked(serviciosApi.contarCitasFuturas).mockResolvedValue(2);
    renderConQuery();
    await elegirDelMenu("Eliminar servicio");
    const dialogo = await screen.findByRole("dialog", { name: "No se puede eliminar todavía" });
    expect(dialogo).toHaveTextContent("Tiene 2 citas pendientes o confirmadas desde hoy");
    expect(serviciosApi.contarCitasFuturas).toHaveBeenCalledWith("svc-1");
    expect(dialogo).toHaveTextContent("Si eliges «Ocultar de reservas», esas 2 citas se mantienen en la agenda.");
    expect(screen.getByRole("link", { name: "Ver citas desde hoy" })).toHaveAttribute("href", expect.stringContaining("/dashboard/citas?desde="));
    expect(screen.queryByRole("button", { name: "Eliminar servicio" })).not.toBeInTheDocument();
    // Ocultar sigue disponible como acción principal.
    expect(screen.getByRole("button", { name: "Ocultar de reservas" })).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Descanso (min)"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Precio (MXN) *"), { target: { value: "10.555" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear servicio" }));

    expect(await screen.findByText("Mínimo 5 minutos")).toBeInTheDocument();
    expect(screen.getByText("Máximo 120 minutos")).toBeInTheDocument();
    expect(screen.getByText("Usa como máximo dos decimales (centavos)")).toBeInTheDocument();
    expect(screen.getByLabelText("Precio (MXN) *")).toHaveAttribute("aria-invalid", "true");
    expect(serviciosApi.crear).not.toHaveBeenCalled();
  });

  it("sin campo Orden y con la etiqueta corta del descanso y su ayuda (M11)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([{ ...mockServicio, orden: 7 }]);
    vi.mocked(serviciosApi.crear).mockResolvedValue({} as never);
    renderConQuery();
    await screen.findByText("Corte de cabello");
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo servicio" }));
    await screen.findByRole("dialog", { name: "Nuevo servicio" });
    expect(screen.queryByLabelText("Orden")).toBeNull();
    expect(screen.getByLabelText("Descanso (min)")).toHaveAccessibleDescription(/tiempo libre que se aparta después de cada cita/);
    llenarNombre();
    fireEvent.click(screen.getByRole("button", { name: "Crear servicio" }));
    // El nuevo entra al final del catálogo.
    await waitFor(() => expect(serviciosApi.crear).toHaveBeenCalledWith(expect.objectContaining({ orden: 8 })));
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
    // El destacado se anuncia con el texto de la acción del menú y, si lo es,
    // con la insignia junto al nombre.
    const menu = await abrirMenu();
    expect(within(menu).getByRole("button", { name: mockServicio.destacado ? "Quitar de destacados" : "Marcar como destacado" })).toBeInTheDocument();
  });

  it("un servicio destacado lleva la insignia y el menú ofrece quitarlo", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([{ ...mockServicio, destacado: true }]);
    vi.mocked(serviciosApi.toggleDestacado).mockResolvedValue({} as never);
    renderConQuery();
    expect(await screen.findByText("Destacado")).toBeInTheDocument();
    await elegirDelMenu("Quitar de destacados");
    await waitFor(() => expect(serviciosApi.toggleDestacado).toHaveBeenCalledWith(expect.objectContaining({ id: "svc-1" })));
  });

  it("el texto 'Visible en reservas' va junto al switch, sin encimarse (I9)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio]);
    renderConQuery();
    const sw = await screen.findByRole("switch", { name: "Visible en reservas: Corte de cabello" });
    const grupo = sw.parentElement!;
    const texto = within(grupo).getByText("Visible en reservas");
    // El texto es hermano del switch, no está dentro de su botón de 44 px.
    expect(sw.contains(texto)).toBe(false);
    // Separación propia y ningún margen negativo que lo meta bajo el riel.
    expect(grupo.className).toMatch(/\bgap-\d/);
    expect(texto.className).not.toMatch(/(^|\s)-m[lx]-/);
    expect(texto.className).toContain("whitespace-nowrap");
  });

  it("una petición en curso solo bloquea la fila de ese servicio", async () => {
    const otro = { ...mockServicio, id: "svc-2", nombre: "Barba" };
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([mockServicio, otro]);
    vi.mocked(serviciosApi.toggleDestacado).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    await elegirDelMenu("Marcar como destacado");
    await waitFor(() => expect(serviciosApi.toggleDestacado).toHaveBeenCalled());
    const menuCorte = await abrirMenu("Corte de cabello");
    expect(within(menuCorte).getByRole("button", { name: "Marcar como destacado" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Más acciones de Corte de cabello" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const menuBarba = await abrirMenu("Barba");
    expect(within(menuBarba).getByRole("button", { name: "Marcar como destacado" })).toBeEnabled();
  });

  it("al eliminar sugiere ocultarlo como alternativa reversible (OM-17)", async () => {
    vi.mocked(serviciosApi.obtenerTodos).mockResolvedValue([{ ...mockServicio, activo: true }]);
    renderConQuery();
    await elegirDelMenu("Eliminar servicio");
    expect(await screen.findByText(/ocúltalo de tu página de reservas/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Ocultar de reservas" })).toBeInTheDocument();
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
