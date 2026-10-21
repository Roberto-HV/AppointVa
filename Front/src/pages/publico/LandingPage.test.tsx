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
