import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import Tabs from "./Tabs";

const OPCIONES = ["Perfil", "Apariencia", "Citas", "Anticipos", "Horarios", "Cuenta"].map((l) => ({ id: l, label: l }));

function Bandeja() {
  const [valor, setValor] = useState("Perfil");
  return <Tabs etiqueta="Secciones" opciones={OPCIONES} valor={valor} onChange={setValor} />;
}

/** jsdom no mide: se le da a la tira un ancho visible menor que su contenido. */
function medidas(nav: HTMLElement, { visible, total, scroll }: { visible: number; total: number; scroll: number }) {
  Object.defineProperty(nav, "clientWidth", { configurable: true, value: visible });
  Object.defineProperty(nav, "scrollWidth", { configurable: true, value: total });
  Object.defineProperty(nav, "scrollLeft", { configurable: true, writable: true, value: scroll });
}

describe("Tabs — pista de que hay más pestañas (M6)", () => {
  it("muestra el degradado del lado que tiene más y lo quita al llegar al borde", () => {
    render(<Bandeja />);
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    const caja = nav.parentElement!;
    medidas(nav, { visible: 300, total: 600, scroll: 0 });
    fireEvent.scroll(nav);
    expect(caja).toHaveAttribute("data-mas-derecha");
    expect(caja).not.toHaveAttribute("data-mas-izquierda");

    medidas(nav, { visible: 300, total: 600, scroll: 300 });
    fireEvent.scroll(nav);
    expect(caja).toHaveAttribute("data-mas-izquierda");
    expect(caja).not.toHaveAttribute("data-mas-derecha");
  });

  it("sin desborde no hay degradado", () => {
    render(<Bandeja />);
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    medidas(nav, { visible: 600, total: 600, scroll: 0 });
    fireEvent.scroll(nav);
    expect(nav.parentElement).not.toHaveAttribute("data-mas-derecha");
  });

  it("al elegir una pestaña la lleva al centro de la tira", () => {
    render(<Bandeja />);
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    medidas(nav, { visible: 300, total: 600, scroll: 0 });
    const scrollTo = vi.fn();
    nav.scrollTo = scrollTo as unknown as typeof nav.scrollTo;
    const cuenta = screen.getByRole("button", { name: "Cuenta" });
    Object.defineProperty(cuenta, "offsetLeft", { configurable: true, value: 500 });
    Object.defineProperty(cuenta, "offsetWidth", { configurable: true, value: 80 });
    fireEvent.click(cuenta);
    expect(scrollTo).toHaveBeenCalledWith({ left: 500 - (300 - 80) / 2, behavior: "smooth" });
  });
});
