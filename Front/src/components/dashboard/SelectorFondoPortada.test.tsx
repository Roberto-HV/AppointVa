import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectorFondoPortada from "./SelectorFondoPortada";
import { PRESETS_PORTADA, fondoPortada } from "../../lib/portadaPresets";

const COLOR = "#9333EA";

function montar(props: Partial<React.ComponentProps<typeof SelectorFondoPortada>> = {}) {
  const onCambiar = vi.fn();
  render(
    <SelectorFondoPortada valor={null} onCambiar={onCambiar} color={COLOR} {...props} />
  );
  return { onCambiar };
}

describe("SelectorFondoPortada", () => {
  it("ofrece el tinte suave más la opción por defecto", () => {
    montar();
    const opciones = screen.getAllByRole("radio");
    expect(opciones).toHaveLength(PRESETS_PORTADA.length + 1);
    for (const preset of PRESETS_PORTADA) {
      expect(screen.getByText(preset.nombre)).toBeInTheDocument();
    }
  });

  it("ya no ofrece patrones ni texturas", () => {
    montar();
    expect(screen.queryByText("Geométricos")).not.toBeInTheDocument();
    expect(screen.queryByText("Arcos")).not.toBeInTheDocument();
    expect(screen.queryByText("Arena")).not.toBeInTheDocument();
  });

  it("previsualiza cada fondo con el color del negocio, no con una muestra genérica", () => {
    const { container } = render(
      <SelectorFondoPortada valor={null} onCambiar={vi.fn()} color={COLOR} />
    );
    const estilos = Array.from(container.querySelectorAll<HTMLElement>("span[style]")).map(
      (el) => el.style.background
    );
    const esperado = document.createElement("div");
    esperado.style.background = fondoPortada("deg-halo", COLOR).background;
    expect(estilos).toContain(esperado.style.background);
  });

  it("es operable con teclado: los fondos son radios de un mismo grupo", async () => {
    const { onCambiar } = montar();
    const opciones = screen.getAllByRole("radio") as HTMLInputElement[];
    const nombres = new Set(opciones.map((o) => o.name));
    expect(nombres.size).toBe(1);

    await userEvent.tab();
    expect(opciones[0]).toHaveFocus();
    // Las flechas mueven la selección dentro del grupo sin tocar el ratón.
    await userEvent.keyboard("{ArrowRight}");
    expect(onCambiar).toHaveBeenCalledWith(PRESETS_PORTADA[0].clave);
  });

  it("marca la selección con una palomita, no solo con color", () => {
    const { container } = render(
      <SelectorFondoPortada valor="deg-halo" onCambiar={vi.fn()} color={COLOR} />
    );
    const elegido = screen.getByRole("radio", { checked: true }) as HTMLInputElement;
    expect(elegido).toBeChecked();
    expect(elegido.closest("label")).toHaveTextContent("Tinte suave");
    // La tarjeta elegida lleva un icono además del borde.
    expect(container.querySelectorAll("svg.lucide-check").length).toBe(1);
  });

  it("muestra la foto subida como una opción más y la elige cuando no hay fondo", () => {
    montar({ portadaUrl: "https://cdn.test/portada.jpg" });
    expect(screen.getByText("Tu foto")).toBeInTheDocument();
    expect(screen.queryByText("Color de marca")).not.toBeInTheDocument();
    const elegido = screen.getByRole("radio", { checked: true });
    expect(elegido.closest("label")).toHaveTextContent("Tu foto");
  });

  it("una clave retirada se muestra como su reemplazo", () => {
    montar({ valor: "deg-aurora" });
    expect(screen.getByRole("radio", { checked: true }).closest("label")).toHaveTextContent("Tinte suave");
  });

  it("un patrón retirado vuelve a la foto si la hay", () => {
    montar({ valor: "geo-arcos", portadaUrl: "https://cdn.test/p.jpg" });
    expect(screen.getByRole("radio", { checked: true }).closest("label")).toHaveTextContent("Tu foto");
  });

  it("vuelve a la foto al elegir esa opción", async () => {
    const { onCambiar } = montar({ valor: "deg-halo", portadaUrl: "https://cdn.test/p.jpg" });
    await userEvent.click(screen.getByText("Tu foto"));
    expect(onCambiar).toHaveBeenCalledWith(null);
  });
});
