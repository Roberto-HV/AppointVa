import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker, TimePicker } from "./DateTimePicker";

/** Emula un móvil de 390px de ancho. */
function anchoViewport(px: number) {
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: px, configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: 844, configurable: true,
  });
}

/** Coloca el trigger donde jsdom no lo hace: jsdom siempre reporta ceros. */
function situarTrigger(el: HTMLElement, left: number, ancho: number) {
  el.getBoundingClientRect = () =>
    ({ left, right: left + ancho, top: 300, bottom: 344, width: ancho, height: 44, x: left, y: 300, toJSON: () => ({}) }) as DOMRect;
}

describe("DatePicker", () => {
  it("el trigger está etiquetado y anuncia si el popover está abierto", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={vi.fn()} ariaLabel="Hasta" />);
    const trigger = screen.getByRole("button", { name: "Hasta" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("el calendario se monta en un portal fuera del contenedor recortado", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="overflow-x-hidden">
        <DatePicker value="" onChange={vi.fn()} ariaLabel="Hasta" />
      </div>
    );
    await user.click(screen.getByRole("button", { name: "Hasta" }));

    const popover = screen.getByRole("dialog", { name: /calendario/i });
    expect(popover).toBeInTheDocument();
    // Si siguiera dentro del contenedor, `overflow-x-hidden` lo recortaría.
    expect(container.contains(popover)).toBe(false);
    expect(document.body.contains(popover)).toBe(true);
  });

  // Escenario real del bug: en CitasPage los dos pickers comparten un `flex
  // gap-2`, así que "Hasta" arranca en x≈207 sobre una pantalla de 390px. Sin
  // sujeción, el calendario de 352px se salía ~170px por la derecha y quedaba
  // recortado (no desplazable) por el `overflow-x-hidden` de la página.
  it("el calendario del segundo picker no se sale por la derecha a 390px", async () => {
    anchoViewport(390);
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={vi.fn()} ariaLabel="Hasta" />);

    const trigger = screen.getByRole("button", { name: "Hasta" });
    situarTrigger(trigger, 207, 175);
    await user.click(trigger);

    const popover = screen.getByRole("dialog", { name: /calendario/i });
    const left = parseFloat(popover.style.left);
    const width = parseFloat(popover.style.width);
    expect(popover.style.position).toBe("fixed");
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(390);
    // Se alineó al borde derecho en vez de al trigger: ahí estaba el desbordamiento.
    expect(left).toBeLessThan(207);
  });

  it("el calendario se estrecha si no cabe ni siquiera pegado al borde", async () => {
    anchoViewport(320);
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={vi.fn()} ariaLabel="Hasta" />);

    const trigger = screen.getByRole("button", { name: "Hasta" });
    situarTrigger(trigger, 160, 150);
    await user.click(trigger);

    const popover = screen.getByRole("dialog", { name: /calendario/i });
    const left = parseFloat(popover.style.left);
    const width = parseFloat(popover.style.width);
    expect(width).toBeLessThanOrEqual(320);
    expect(left + width).toBeLessThanOrEqual(320);
  });

  it("se cierra con Escape", async () => {
    const user = userEvent.setup();
    render(<DatePicker value="" onChange={vi.fn()} ariaLabel="Hasta" />);
    await user.click(screen.getByRole("button", { name: "Hasta" }));
    expect(screen.getByRole("dialog", { name: /calendario/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /calendario/i })).not.toBeInTheDocument();
  });

  it("se cierra al hacer clic fuera", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">fuera</button>
        <DatePicker value="" onChange={vi.fn()} ariaLabel="Hasta" />
      </div>
    );
    await user.click(screen.getByRole("button", { name: "Hasta" }));
    await user.click(screen.getByRole("button", { name: "fuera" }));
    expect(screen.queryByRole("dialog", { name: /calendario/i })).not.toBeInTheDocument();
  });

  it("selecciona una fecha del mes visible", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DatePicker value="2026-03-10" onChange={onChange} ariaLabel="Desde" />);
    await user.click(screen.getByRole("button", { name: /Desde/ }));
    await user.click(screen.getByRole("button", { name: "18" }));
    expect(onChange).toHaveBeenCalledWith("2026-03-18");
  });
});

describe("TimePicker", () => {
  it("abre un listbox etiquetado en un portal", async () => {
    const user = userEvent.setup();
    render(<TimePicker value="" onChange={vi.fn()} ariaLabel="Inicio" />);
    await user.click(screen.getByRole("button", { name: "Inicio" }));
    expect(screen.getByRole("listbox", { name: "Inicio" })).toBeInTheDocument();
  });

  it("queda dentro del viewport a 390px aunque el trigger esté a la derecha", async () => {
    anchoViewport(390);
    const user = userEvent.setup();
    render(<TimePicker value="" onChange={vi.fn()} ariaLabel="Inicio" />);

    const trigger = screen.getByRole("button", { name: "Inicio" });
    situarTrigger(trigger, 300, 80);
    await user.click(trigger);

    const popover = screen.getByRole("dialog", { name: /horas/i });
    const left = parseFloat(popover.style.left);
    const width = parseFloat(popover.style.width);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(390);
  });

  it("se cierra con Escape", async () => {
    const user = userEvent.setup();
    render(<TimePicker value="" onChange={vi.fn()} ariaLabel="Inicio" />);
    await user.click(screen.getByRole("button", { name: "Inicio" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Inicio" })).not.toBeInTheDocument();
  });
});
