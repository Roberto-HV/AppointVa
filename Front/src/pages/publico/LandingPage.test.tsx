import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";

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
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

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

  it("el dorado de la marca solo queda en el logo", () => {
    const { container } = renderLanding();
    const conDorado = [...container.querySelectorAll<HTMLElement>("[style]")]
      .filter((el) => /c8a961|200,\s*169,\s*97/i.test(el.getAttribute("style") ?? ""));
    expect(conDorado.length).toBeGreaterThan(0);
    expect(conDorado.every((el) => el.textContent === "Va")).toBe(true);
  });
});
