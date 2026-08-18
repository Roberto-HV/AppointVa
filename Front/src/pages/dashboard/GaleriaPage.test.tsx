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
      expect(negociosApi.subirImagenGaleria).toHaveBeenCalledWith(file)
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
    const confirmBtn = await screen.findByText("Eliminar", {
      selector: "button",
    });
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

    const cancelBtn = await screen.findByRole("button", { name: "Cancelar" });
    fireEvent.click(cancelBtn);

    expect(negociosApi.eliminarImagenGaleria).not.toHaveBeenCalled();
  });
});
