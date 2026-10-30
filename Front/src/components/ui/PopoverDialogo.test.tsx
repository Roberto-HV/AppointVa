import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PopoverDialogo from "./PopoverDialogo";

const rect = (top: number, left: number, alto: number, ancho: number) =>
  ({ top, left, bottom: top + alto, right: left + ancho, width: ancho, height: alto, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

/** Contenedor con desplazamiento (0–300px) y un ancla dentro, en `top`. */
function montarAncla(topAncla: number) {
  const contenedor = document.createElement("div");
  contenedor.style.overflowY = "auto";
  contenedor.getBoundingClientRect = () => rect(0, 0, 300, 400);
  const ancla = document.createElement("button");
  ancla.textContent = "Bloque";
  let top = topAncla;
  ancla.getBoundingClientRect = () => rect(top, 10, 20, 100);
  contenedor.appendChild(ancla);
  document.body.appendChild(contenedor);
  montados.push(contenedor);
  return { contenedor, ancla, mover: (t: number) => { top = t; } };
}

const montados: HTMLElement[] = [];
// Solo lo que montó la prueba: el contenedor de RTL lo limpia su propio cleanup.
afterEach(() => {
  montados.splice(0).forEach((el) => el.remove());
});

describe("PopoverDialogo — el ancla deja de existir o de verse", () => {
  it("con el ancla a la vista se queda abierto y sigue al desplazarse", () => {
    const { contenedor, mover } = montarAncla(100);
    const onCerrar = vi.fn();
    render(<PopoverDialogo ancla={contenedor.firstChild as HTMLElement} titulo="Acciones" onCerrar={onCerrar}>Menú</PopoverDialogo>);
    expect(screen.getByRole("dialog", { name: "Acciones" })).toBeInTheDocument();
    mover(150);
    fireEvent.scroll(contenedor);
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it("se cierra si el ancla se desmonta (un refresco o el '+N' la quitan)", async () => {
    const { contenedor, ancla } = montarAncla(100);
    const onCerrar = vi.fn();
    render(<PopoverDialogo ancla={ancla} titulo="Acciones" onCerrar={onCerrar}>Menú</PopoverDialogo>);
    contenedor.removeChild(ancla);
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1));
  });

  it("se cierra si el ancla sale de la vista de su contenedor al desplazarse", () => {
    const { contenedor, ancla, mover } = montarAncla(100);
    const onCerrar = vi.fn();
    render(<PopoverDialogo ancla={ancla} titulo="Acciones" onCerrar={onCerrar}>Menú</PopoverDialogo>);
    mover(-80); // por encima del borde superior del contenedor
    fireEvent.scroll(contenedor);
    expect(onCerrar).toHaveBeenCalledTimes(1);
    // Más desplazamiento no vuelve a avisar.
    fireEvent.scroll(contenedor);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("se cierra si el ancla queda fuera de la ventana", () => {
    const { contenedor, ancla, mover } = montarAncla(100);
    // Contenedor más alto que la ventana: lo que recorta aquí es la ventana.
    contenedor.getBoundingClientRect = () => rect(0, 0, window.innerHeight * 3, 400);
    const onCerrar = vi.fn();
    render(<PopoverDialogo ancla={ancla} titulo="Acciones" onCerrar={onCerrar}>Menú</PopoverDialogo>);
    mover(window.innerHeight + 50);
    fireEvent(window, new Event("resize"));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
