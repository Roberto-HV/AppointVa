import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GaleriaPage from "./GaleriaPage";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => ({ toast: mockToast }),
}));

vi.mock("../../store/authStore", () => ({
  useAuthStore: () => ({ negocioId: "neg-1", usuario: { rol: "Propietario" } }),
}));

vi.mock("../../api/negocios", () => ({
  negociosApi: {
    obtenerGaleria: vi.fn(),
    subirImagenGaleria: vi.fn(),
    eliminarImagenGaleria: vi.fn(),
  },
}));

import { negociosApi } from "../../api/negocios";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeImagen = (overrides = {}) => ({
  id: "1",
  url: "https://example.com/img.jpg",
  orden: 1,
  fechaCreacion: "2026-01-01T00:00:00Z",
  ...overrides,
});

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <GaleriaPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GaleriaPage — skeleton de carga", () => {
  it("muestra elementos animate-pulse mientras se carga la galería", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    await waitFor(() =>
      expect(container.querySelector(".animate-pulse")).toBeTruthy()
    );
  });
});

describe("GaleriaPage — estado vacío", () => {
  it("muestra la zona de arrastre cuando no hay fotos", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    renderConQuery();
    await waitFor(() =>
      expect(
        screen.getByText(/Arrastra fotos aquí o haz clic para seleccionar/i)
      ).toBeInTheDocument()
    );
  });
});

describe("GaleriaPage — grid de imágenes", () => {
  it("muestra la imagen al cargar la galería", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([makeImagen()]);
    const { container } = renderConQuery();
    await waitFor(() => {
      const img = container.querySelector(
        'img[src="https://example.com/img.jpg"]'
      );
      expect(img).toBeInTheDocument();
    });
  });
});

describe("GaleriaPage — validación de tipo de archivo", () => {
  it("rechaza archivos no-imagen y no llama a subirImagenGaleria", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    renderConQuery();
    await screen.findByText(/Arrastra fotos aquí/i);

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(negociosApi.subirImagenGaleria).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("doc.pdf"),
      "error"
    );
  });
});

describe("GaleriaPage — validación de tamaño de archivo", () => {
  it("rechaza archivos que superan 10 MB y no llama a subirImagenGaleria", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    renderConQuery();
    await screen.findByText(/Arrastra fotos aquí/i);

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const bigFile = new File(["x"], "large-photo.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(negociosApi.subirImagenGaleria).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining("large-photo.jpg"),
      "error"
    );
  });
});

describe("GaleriaPage — subida válida", () => {
  it("llama a subirImagenGaleria con un archivo de imagen válido", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    vi.mocked(negociosApi.subirImagenGaleria).mockResolvedValue(makeImagen());
    renderConQuery();
    await screen.findByText(/Arrastra fotos aquí/i);

    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(negociosApi.subirImagenGaleria).toHaveBeenCalledWith(file, undefined, expect.any(Function))
    );
  });
});

describe("GaleriaPage — confirmar eliminación", () => {
  it("llama a eliminarImagenGaleria al confirmar la eliminación", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([makeImagen()]);
    vi.mocked(negociosApi.eliminarImagenGaleria).mockResolvedValue(undefined);
    renderConQuery();

    // Trash button identified by its title attribute
    const trashBtn = await screen.findByTitle("Eliminar");
    fireEvent.click(trashBtn);

    // Modal confirm button identified by its text content (not the icon-only trash btn)
    const confirmBtn = await screen.findByRole("button", { name: "Eliminar foto" });
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(negociosApi.eliminarImagenGaleria).toHaveBeenCalledWith("1")
    );
  });
});

describe("GaleriaPage — cancelar eliminación", () => {
  it("no llama a eliminarImagenGaleria al cancelar", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([makeImagen()]);
    renderConQuery();

    const trashBtn = await screen.findByTitle("Eliminar");
    fireEvent.click(trashBtn);

    const cancelBtn = await screen.findByRole("button", { name: "Volver" });
    fireEvent.click(cancelBtn);

    expect(negociosApi.eliminarImagenGaleria).not.toHaveBeenCalled();
  });
});

describe("GaleriaPage — acciones sin hover (OM-07)", () => {
  it("cada foto tiene botones con nombre para ampliar y eliminar", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([makeImagen()]);
    renderConQuery();
    expect(await screen.findByRole("button", { name: "Ver foto 1 ampliada" })).toBeInTheDocument();
    const eliminar = screen.getByRole("button", { name: "Eliminar foto 1" });
    // Visible por defecto: solo se oculta donde hay hover real.
    expect(eliminar.className).toMatch(/(^|\s)opacity-100(\s|$)/);
    expect(eliminar.className).toContain("focus-visible:opacity-100");
  });
});

describe("GaleriaPage — subidas (OM-14)", () => {
  it("muestra una miniatura con avance por cada foto que se sube", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    vi.mocked(negociosApi.subirImagenGaleria).mockImplementation((_f, _d, onProgreso) => {
      onProgreso?.(60);
      return new Promise(() => {});
    });
    renderConQuery();
    await screen.findByText(/Arrastra fotos aquí/i);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.png", { type: "image/png" })] },
    });
    const barras = await screen.findAllByRole("progressbar");
    expect(barras).toHaveLength(2);
    expect(screen.getByRole("progressbar", { name: "Subiendo a.jpg" })).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByRole("button", { name: /Subiendo 2…/ })).toBeInTheDocument();
  });

  it("avisa cuántas fotos no entraron por el límite de 20", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue(
      Array.from({ length: 19 }, (_, i) => makeImagen({ id: String(i), url: `https://x/${i}.jpg` })),
    );
    vi.mocked(negociosApi.subirImagenGaleria).mockReturnValue(new Promise(() => {}));
    renderConQuery();
    await screen.findByRole("button", { name: "Ver foto 19 ampliada" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const archivos = ["1", "2", "3"].map((n) => new File([n], `${n}.jpg`, { type: "image/jpeg" }));
    fireEvent.change(input, { target: { files: archivos } });
    expect(mockToast).toHaveBeenCalledWith("2 fotos no se agregaron: el límite es de 20 fotos.", "error");
    await waitFor(() => expect(negociosApi.subirImagenGaleria).toHaveBeenCalledTimes(1));
  });

  it("resalta la zona al arrastrar encima y acepta solo los formatos del servidor", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    renderConQuery();
    const zona = (await screen.findByText(/Arrastra fotos aquí/i)).closest("button")!;
    fireEvent.dragEnter(zona);
    expect(zona).toHaveAttribute("data-arrastrando", "true");
    expect(screen.getByText("Suelta las fotos para subirlas")).toBeInTheDocument();
    expect((document.querySelector('input[type="file"]') as HTMLInputElement).accept).not.toContain("image/*");
    expect(screen.getByText(/hasta 10 MB/)).toBeInTheDocument();
  });

  it("un HEIC se rechaza antes de subir", async () => {
    vi.mocked(negociosApi.obtenerGaleria).mockResolvedValue([]);
    renderConQuery();
    await screen.findByText(/Arrastra fotos aquí/i);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "foto.heic", { type: "image/heic" })] } });
    expect(negociosApi.subirImagenGaleria).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('"foto.heic" no es JPG, PNG, WebP o GIF.', "error");
  });
});
