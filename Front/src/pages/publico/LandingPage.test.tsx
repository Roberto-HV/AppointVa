import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingPage from "./LandingPage";
import { publicoApi } from "../../api/publico";
import type { NegocioPublico } from "../../types";

vi.mock("../../api/publico", () => ({
  publicoApi: { obtenerNegocio: vi.fn() },
}));

const obtenerNegocio = vi.mocked(publicoApi.obtenerNegocio);

beforeEach(() => {
  obtenerNegocio.mockReset();
  obtenerNegocio.mockResolvedValue({} as NegocioPublico);
});

beforeAll(() => {
  // jsdom no trae IntersectionObserver; las animaciones no importan aquí.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
});

function renderLanding() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function tarjetaNegocio(nombre: string) {
  return screen.getByRole("link", { name: `Abrir la página de reservas de ${nombre}` });
}

describe("LandingPage — logos de los negocios reales", () => {
  it("muestra el logo del negocio cuando su página pública lo tiene", async () => {
    obtenerNegocio.mockImplementation(async (slug) =>
      ({ logoUrl: slug === "aramis-manzo-salon" ? "https://cdn.example.com/aramis.png" : undefined }) as NegocioPublico
    );
    renderLanding();
    const aramis = tarjetaNegocio("Aramis Manzo Salón");
    await waitFor(() => expect(aramis.querySelector("img")).toHaveAttribute("src", "https://cdn.example.com/aramis.png"));
    const img = aramis.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(obtenerNegocio).toHaveBeenCalledWith("aramis-manzo-salon");
    // El otro negocio no tiene logo: quedan sus iniciales y ninguna imagen.
    const lashes = tarjetaNegocio("Lashes_crisantemo");
    expect(within(lashes).getByText("LC")).toBeInTheDocument();
    expect(lashes.querySelector("img")).toBeNull();
  });

  it("vuelve a las iniciales si la imagen del logo no carga", async () => {
    obtenerNegocio.mockResolvedValue({ logoUrl: "https://cdn.example.com/roto.png" } as NegocioPublico);
    renderLanding();
    const aramis = tarjetaNegocio("Aramis Manzo Salón");
    await waitFor(() => expect(aramis.querySelector("img")).not.toBeNull());
    fireEvent.error(aramis.querySelector("img")!);
    expect(aramis.querySelector("img")).toBeNull();
    expect(within(aramis).getByText("AM")).toBeInTheDocument();
  });

  it("muestra las iniciales mientras carga o si la consulta falla, e ignora URLs que no son http(s)", async () => {
    obtenerNegocio.mockImplementation(async (slug) => {
      if (slug === "aramis-manzo-salon") throw new Error("sin red");
      return { logoUrl: "javascript:alert(1)" } as NegocioPublico;
    });
    renderLanding();
    expect(within(tarjetaNegocio("Aramis Manzo Salón")).getByText("AM")).toBeInTheDocument();
    await waitFor(() => expect(obtenerNegocio).toHaveBeenCalledTimes(2));
    expect(tarjetaNegocio("Aramis Manzo Salón").querySelector("img")).toBeNull();
    expect(tarjetaNegocio("Lashes_crisantemo").querySelector("img")).toBeNull();
    expect(within(tarjetaNegocio("Lashes_crisantemo")).getByText("LC")).toBeInTheDocument();
  });
});

describe("LandingPage — estados accesibles y precios (AP-20)", () => {
  it("el interruptor de facturación expone su estado", async () => {
    const user = userEvent.setup();
    renderLanding();
    const mensual = screen.getByRole("button", { name: "Mensual" });
    const anual = screen.getByRole("button", { name: /^Anual/ });
    expect(mensual).toHaveAttribute("aria-pressed", "true");
    expect(anual).toHaveAttribute("aria-pressed", "false");
    await user.click(anual);
    expect(anual).toHaveAttribute("aria-pressed", "true");
  });

  it("en Anual, el plan Próximamente no lleva nota de facturación", async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole("button", { name: /^Anual/ }));
    const premium = screen.getByText("Premium").closest("div.relative") as HTMLElement;
    expect(within(premium).getByText("Próximamente disponible")).toBeInTheDocument();
    expect(within(premium).queryByText(/Sin descuento anual/)).not.toBeInTheDocument();
  });

  it("las preguntas frecuentes anuncian si están abiertas", async () => {
    const user = userEvent.setup();
    renderLanding();
    const pregunta = screen.getByRole("button", { name: /necesitan descargarse una app/ });
    expect(pregunta).toHaveAttribute("aria-expanded", "false");
    await user.click(pregunta);
    expect(pregunta).toHaveAttribute("aria-expanded", "true");
    const id = pregunta.getAttribute("aria-controls")!;
    expect(document.getElementById(id)).toBeInTheDocument();
  });

  it("el menú móvil anuncia si está abierto", async () => {
    const user = userEvent.setup();
    renderLanding();
    const menu = screen.getByRole("button", { name: "Abrir menú" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    await user.click(menu);
    expect(screen.getByRole("button", { name: "Cerrar menú" })).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("menu-movil-landing")).toBeInTheDocument();
  });
});

describe("LandingPage — copy honesto y precios (decisiones 1, 5, 16, 18)", () => {
  it("no promete nada gratis ni '5 minutos'; los CTA dicen 'Crear mi cuenta' / 'Empezar ahora'", () => {
    const { container } = renderLanding();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/gratis/i);
    expect(texto).not.toMatch(/(^|[^\d])5 min(utos)?\b/);
    expect(screen.getAllByRole("link", { name: "Crear mi cuenta" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Empezar ahora/ })).toHaveAttribute("href", "/registro");
  });

  it("Pro anual muestra $382 MXN/mes con su ahorro, y los precios llevan MXN", async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole("button", { name: /^Anual/ }));
    const pro = screen.getByText("Pro").closest("div.relative") as HTMLElement;
    expect(within(pro).getByText("$382")).toBeInTheDocument();
    expect(within(pro).getByText("MXN/mes")).toBeInTheDocument();
    expect(within(pro).getByText(/Ahorras \$804 MXN\/año/)).toBeInTheDocument();
    expect(within(pro).queryByText(/Sin descuento anual/)).not.toBeInTheDocument();
  });

  it("explica que las notificaciones se envían por correo", async () => {
    const user = userEvent.setup();
    renderLanding();
    await user.click(screen.getByRole("button", { name: /Cómo se avisa a mis clientes/ }));
    expect(screen.getByText(/Las notificaciones se envían por correo/)).toBeInTheDocument();
  });

  it("el dorado de la marca es el acento del hero y del plan destacado, y el logo es la imagen de AppointVa", () => {
    renderLanding();
    // Mismo dorado que el "Va" del logo (ORO_LOGO, #EEB114).
    const dorado = /^rgb\(238, 177, 20\)$/;
    expect(screen.getByText("Sin llamadas.").style.color).toMatch(dorado);
    expect(screen.getByText("Más popular").style.backgroundColor).toMatch(dorado);

    // Sin el wordmark de texto: el enlace al inicio es el logo real.
    const inicio = screen.getAllByRole("link", { name: "AppointVa" })[0];
    expect(inicio).toHaveAttribute("href", "/");
    expect(within(inicio).getByRole("img", { name: "AppointVa" }).getAttribute("src")).toMatch(/^\/logo-appointva/);
    // Pie oscuro: la variante de texto blanco.
    expect(screen.getAllByAltText("AppointVa").some((img) => img.getAttribute("src") === "/logo-appointva-oscuro.png")).toBe(true);
    expect(screen.queryByText("Appoint")).not.toBeInTheDocument();
  });
});
