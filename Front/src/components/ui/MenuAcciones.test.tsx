import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Star, Trash2 } from "lucide-react";
import MenuAcciones from "./MenuAcciones";

const matchMediaOriginal = window.matchMedia;
function simular(movil: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: movil && q.includes("max-width"),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}
afterEach(() => { window.matchMedia = matchMediaOriginal; });

function renderMenu(onDestacar = vi.fn(), onEliminar = vi.fn()) {
  render(
    <MenuAcciones
      etiqueta="Más acciones de Corte"
      acciones={[
        { id: "eliminar", etiqueta: "Eliminar servicio", Icono: Trash2, destructiva: true, onSelect: onEliminar },
        { id: "destacar", etiqueta: "Marcar como destacado", Icono: Star, onSelect: onDestacar },
      ]}
    />,
  );
  return { onDestacar, onEliminar };
}

describe("MenuAcciones (⋯)", () => {
  it("es un botón de 44px con nombre que abre un popover junto a él en escritorio", async () => {
    simular(false);
    renderMenu();
    const boton = screen.getByRole("button", { name: "Más acciones de Corte" });
    expect(boton.className).toContain("min-h-[44px]");
    expect(boton).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(boton);
    const menu = await screen.findByRole("dialog", { name: "Más acciones de Corte" });
    expect(menu).toHaveAttribute("data-popover");
    expect(boton).toHaveAttribute("aria-expanded", "true");
  });

  it("en el teléfono abre la hoja inferior", async () => {
    simular(true);
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Más acciones de Corte" }));
    const hoja = await screen.findByRole("dialog", { name: "Más acciones de Corte" });
    expect(hoja).toHaveAttribute("data-variante", "hoja");
  });

  it("las destructivas van al final, tras una línea y en rojo", async () => {
    simular(false);
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Más acciones de Corte" }));
    const menu = await screen.findByRole("dialog");
    const acciones = within(menu).getAllByRole("button").map((b) => b.textContent).filter(Boolean);
    expect(acciones).toEqual(["Marcar como destacado", "Eliminar servicio"]);
    expect(within(menu).getByRole("separator")).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Eliminar servicio" }).className).toContain("text-red-700");
  });

  it("elegir una acción cierra el menú y la ejecuta", async () => {
    simular(false);
    const { onDestacar, onEliminar } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Más acciones de Corte" }));
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como destacado" }));
    expect(onDestacar).toHaveBeenCalledTimes(1);
    expect(onEliminar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Escape cierra sin ejecutar nada", async () => {
    simular(false);
    const { onDestacar, onEliminar } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Más acciones de Corte" }));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDestacar).not.toHaveBeenCalled();
    expect(onEliminar).not.toHaveBeenCalled();
  });
});
