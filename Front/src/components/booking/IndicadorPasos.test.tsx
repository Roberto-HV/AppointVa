import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import IndicadorPasos from "./IndicadorPasos";

const PASOS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos"];

// ── BF-10: el indicador dice en qué paso está y cómo se llama ─────────────────
describe("IndicadorPasos", () => {
  it("muestra el número y el nombre del paso actual", () => {
    render(<IndicadorPasos pasoActual={2} pasos={PASOS} />);
    expect(screen.getByText(/Paso 2 de 4/)).toHaveTextContent("Paso 2 de 4 · Profesional");
  });

  // A 375px el nombre se cortaba junto a "Mis citas" ("Fecha y h…"): ahora va
  // en su propia línea, sin truncar.
  it("muestra el nombre completo del paso, sin truncarlo, junto a 'Mis citas'", () => {
    render(<MemoryRouter><IndicadorPasos pasoActual={3} pasos={PASOS} slug="salon-test" /></MemoryRouter>);
    const etiqueta = screen.getByText(/Paso 3 de 4/);
    expect(etiqueta).toHaveTextContent("Paso 3 de 4 · Fecha y hora");
    expect(etiqueta).not.toHaveClass("truncate");
    expect(screen.getByRole("link", { name: /Mis citas/ })).toHaveAttribute("href", "/b/salon-test/mis-citas");
  });

  it("marca el paso actual como aria-current=step dentro de una lista con nombre", () => {
    render(<IndicadorPasos pasoActual={3} pasos={PASOS} />);
    const lista = screen.getByRole("list", { name: "Progreso de la reserva" });
    const items = Array.from(lista.querySelectorAll("li"));
    expect(items).toHaveLength(4);
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent("Servicio (completado)");
    expect(items[3]).not.toHaveAttribute("aria-current");
  });

  it("dibuja las barras con un tono claro, no con el color de marca", () => {
    render(<IndicadorPasos pasoActual={1} pasos={PASOS} />);
    const activa = screen.getByRole("list").querySelector('[aria-current="step"]') as HTMLElement;
    expect(activa.style.background).toBe("rgba(255, 255, 255, 0.9)");
  });
});
