import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ListaEsperaPublicaPage from "./ListaEsperaPublicaPage";
import { brandSolid } from "../../lib/colorUtils";

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...mod,
    useParams: () => ({ slug: "salon-test" }),
    useSearchParams: () => [new URLSearchParams("servicioId=servicio-abc")],
  };
});

vi.mock("../../api/publico", () => ({
  publicoApi: { obtenerNegocio: vi.fn() },
}));

vi.mock("../../api/listaEspera", () => ({
  listaEsperaPublicoApi: { unirse: vi.fn() },
}));

vi.mock("../../components/PublicFooter", () => ({
  default: () => <div data-testid="public-footer" />,
}));

import { publicoApi } from "../../api/publico";
import { listaEsperaPublicoApi } from "../../api/listaEspera";

const mockNegocio = {
  id: "neg-1",
  slug: "salon-test",
  nombre: "Salón Test",
  colorPrimario: "#6366f1",
  colorSecundario: "#4f46e5",
  listaEsperaActiva: true,
  logoUrl: null,
  portadaUrl: null,
  descripcion: null,
  telefono: "5511223344",
  email: "test@test.com",
  direccion: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  servicios: [],
  empleados: [],
  imagenes: [],
  resenas: [],
  autoConfirmar: true,
  metodoNotificacion: "Correo",
  moneda: "MXN",
  zonaHoraria: "Central Standard Time (Mexico)",
};

function renderConQuery() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ListaEsperaPublicaPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ListaEsperaPublicaPage", () => {
  it("muestra el esqueleto de carga mientras obtiene el negocio", () => {
    vi.mocked(publicoApi.obtenerNegocio).mockReturnValue(new Promise(() => {}));
    const { container } = renderConQuery();
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("muestra el formulario cuando la lista de espera está activa", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio as never);
    renderConQuery();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /lista de espera/i })).toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText(/tu nombre completo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/5512345678/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/correo@ejemplo\.com/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unirme/i })).toBeInTheDocument();
  });

  it("muestra el nombre del negocio en el header", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio as never);
    renderConQuery();
    await waitFor(() => expect(screen.getByText("Salón Test")).toBeInTheDocument());
  });

  it("muestra estado inactivo cuando listaEsperaActiva es false", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({
      ...mockNegocio,
      listaEsperaActiva: false,
    } as never);
    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText(/lista de espera no disponible/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /unirme/i })).not.toBeInTheDocument();
  });

  it("muestra error cuando el negocio no existe", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockRejectedValue({ response: { status: 404 } });
    renderConQuery();

    await waitFor(() =>
      expect(screen.getByText(/este negocio no está disponible/i)).toBeInTheDocument()
    );
  });

  it("envía el formulario y muestra el estado de éxito", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio as never);
    vi.mocked(listaEsperaPublicoApi.unirse).mockResolvedValue(undefined as never);
    renderConQuery();

    await waitFor(() => screen.getByPlaceholderText(/tu nombre completo/i));

    fireEvent.change(screen.getByPlaceholderText(/tu nombre completo/i), {
      target: { value: "Ana López" },
    });
    fireEvent.change(screen.getByPlaceholderText(/5512345678/i), {
      target: { value: "5599887766" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unirme/i }));

    await waitFor(() =>
      expect(screen.getByText(/estás en la lista/i)).toBeInTheDocument()
    );
    expect(listaEsperaPublicoApi.unirse).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "salon-test",
        nombreCliente: "Ana López",
        telefonoCliente: "5599887766",
        servicioId: "servicio-abc",
      })
    );
  });

  it("muestra mensaje de error cuando el envío falla", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio as never);
    vi.mocked(listaEsperaPublicoApi.unirse).mockRejectedValue(new Error("Network error"));
    renderConQuery();

    await waitFor(() => screen.getByPlaceholderText(/tu nombre completo/i));

    fireEvent.change(screen.getByPlaceholderText(/tu nombre completo/i), {
      target: { value: "Carlos Ruiz" },
    });
    fireEvent.change(screen.getByPlaceholderText(/5512345678/i), {
      target: { value: "5544332211" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unirme/i }));

    await waitFor(() =>
      expect(screen.getByText(/no se pudo unirte/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /unirme/i })).toBeInTheDocument();
  });

  it("deshabilita el botón mientras se envía el formulario", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio as never);
    vi.mocked(listaEsperaPublicoApi.unirse).mockReturnValue(new Promise(() => {}));
    renderConQuery();

    await waitFor(() => screen.getByPlaceholderText(/tu nombre completo/i));

    fireEvent.change(screen.getByPlaceholderText(/tu nombre completo/i), {
      target: { value: "María Torres" },
    });
    fireEvent.change(screen.getByPlaceholderText(/5512345678/i), {
      target: { value: "5512341234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /unirme/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /uniéndome/i })).toBeDisabled()
    );
  });

  it("muestra el footer en todos los estados principales", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(mockNegocio as never);
    renderConQuery();
    await waitFor(() => screen.getByTestId("public-footer"));
    expect(screen.getByTestId("public-footer")).toBeInTheDocument();
  });
});

describe("ListaEsperaPublicaPage — contraste, servicio y salida (AP-19)", () => {
  const conServicio = {
    ...mockNegocio,
    servicios: [{ id: "servicio-abc", nombre: "Corte de cabello", duracionMinutos: 30, precio: 150 }],
  };

  it("un color de marca claro se oscurece para que el botón se lea", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue({ ...mockNegocio, colorPrimario: "#FBCFE8" } as never);
    renderConQuery();
    const boton = await screen.findByRole("button", { name: /unirme/i });
    const esperado = brandSolid("#FBCFE8");
    expect(esperado.toLowerCase()).not.toBe("#fbcfe8");
    // jsdom normaliza el color a rgb(); se compara contra el mismo valor.
    const probe = document.createElement("div");
    probe.style.background = esperado;
    expect(boton.style.background).toBe(probe.style.background);
  });

  it("nombra el servicio y ofrece volver al negocio", async () => {
    vi.mocked(publicoApi.obtenerNegocio).mockResolvedValue(conServicio as never);
    vi.mocked(listaEsperaPublicoApi.unirse).mockResolvedValue(undefined as never);
    renderConQuery();

    expect(await screen.findByRole("heading", { name: "Lista de espera para Corte de cabello" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a Salón Test/ })).toHaveAttribute("href", "/b/salon-test");

    fireEvent.change(screen.getByPlaceholderText(/tu nombre completo/i), { target: { value: "Ana López" } });
    fireEvent.change(screen.getByPlaceholderText(/5512345678/i), { target: { value: "5599887766" } });
    fireEvent.click(screen.getByRole("button", { name: /unirme/i }));

    await screen.findByText(/estás en la lista/i);
    expect(screen.getByText("Corte de cabello")).toBeInTheDocument();
    expect(screen.getByText(/Salón Test se pondrá en contacto contigo/)).toBeInTheDocument();
    expect(screen.queryByText(/Te avisaremos/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a Salón Test/ })).toBeInTheDocument();
  });
});
