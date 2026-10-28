import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LandingPageSalud } from "./LandingPageSalud";

beforeAll(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
});

function renderSalud() {
  return render(<MemoryRouter><LandingPageSalud /></MemoryRouter>);
}

describe("LandingPageSalud (decisiones 1, 5, 16, 18)", () => {
  it("no muestra 'Negocios reales' ni anuncia WhatsApp para recordatorios", () => {
    const { container } = renderSalud();
    expect(screen.queryByText("Negocios reales")).not.toBeInTheDocument();
    expect(screen.queryByText(/Negocios que ya reservan/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/recordatorios?[^.]*WhatsApp/i);
    expect(container.textContent).not.toMatch(/gratis/i);
  });

  it("tiene FAQ con el canal real y el plazo de activación, y un CTA final al registro de salud", async () => {
    const user = userEvent.setup();
    renderSalud();
    expect(screen.getByRole("heading", { name: "Lo que más nos preguntan" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cómo se avisa a mis pacientes/ }));
    expect(screen.getByText(/Las notificaciones se envían por correo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /proceso de activación/ }));
    expect(screen.getAllByText(/en menos de 24 horas hábiles/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Empezar ahora/ })).toHaveAttribute("href", "/registro?sector=salud");
  });

  it("cada plan lleva su clave al registro de salud (B20)", () => {
    renderSalud();
    expect(screen.getByRole("link", { name: "Empezar con Básico" })).toHaveAttribute("href", "/registro?sector=salud&plan=basico");
    expect(screen.getByRole("link", { name: "Empezar con Pro" })).toHaveAttribute("href", "/registro?sector=salud&plan=pro");
  });
  it("Pro anual a $382 MXN, igual que la landing principal", async () => {
    const user = userEvent.setup();
    renderSalud();
    await user.click(screen.getByRole("button", { name: /^Anual/ }));
    const pro = screen.getByText("Pro").closest("div.relative") as HTMLElement;
    expect(within(pro).getByText("$382")).toBeInTheDocument();
    expect(within(pro).getByText("MXN/mes")).toBeInTheDocument();
  });
});
