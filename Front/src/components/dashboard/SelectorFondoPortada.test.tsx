import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectorFondoPortada from "./SelectorFondoPortada";
import { PRESETS_PORTADA, fondoPortada, fondoPortadaMuestra } from "../../lib/portadaPresets";

const COLOR = "#9333EA";

function montar(props: Partial<React.ComponentProps<typeof SelectorFondoPortada>> = {}) {
  const onCambiar = vi.fn();
  render(
    <SelectorFondoPortada valor={null} onCambiar={onCambiar} color={COLOR} {...props} />
  );
  return { onCambiar };
}

describe("SelectorFondoPortada", () => {
  it("ofrece todos los fondos del catálogo más la opción por defecto", () => {
    montar();
    const opciones = screen.getAllByRole("radio");
    expect(opciones).toHaveLength(PRESETS_PORTADA.length + 1);
    for (const preset of PRESETS_PORTADA) {
      expect(screen.getByText(preset.nombre)).toBeInTheDocument();
    }
  });

  it("agrupa los fondos por familia con un encabezado legible", () => {
    montar();
    expect(screen.getByText("Geométricos")).toBeInTheDocument();
    expect(screen.getByText("Degradados")).toBeInTheDocument();
    expect(screen.getByText("Texturas")).toBeInTheDocument();
    expect(screen.getByText("Materiales")).toBeInTheDocument();
  });

  it("muestra los materiales en su propio grupo, con nombre y como radios del mismo grupo", () => {
    montar();
    const grupo = screen.getByText("Materiales").parentElement!;
    const materiales = PRESETS_PORTADA.filter((p) => p.familia === "material");
    const radios = within(grupo).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(materiales.length);
    expect(new Set(radios.map((r) => r.name))).toEqual(new Set(["fondo-portada"]));
    for (const preset of materiales) {
      // El nombre visible es la etiqueta accesible del radio.
      expect(within(grupo).getByRole("radio", { name: preset.nombre })).toBeInTheDocument();
    }
  });

  it("elegir un material avisa con su clave", async () => {
    const { onCambiar } = montar();
    await userEvent.click(screen.getByText("Cuarzo blanco y oro"));
    expect(onCambiar).toHaveBeenCalledWith("mat-cuarzo-blanco");
  });

  it("la muestra lleva el mismo velo que la portada: fuerte en claro, ligero en oscuro, nada en marca", () => {
    montar();
    const velo = (nombre: string) =>
      screen.getByRole("radio", { name: nombre }).closest("label")!
        .querySelector<HTMLElement>("span.justify-end")!.style.background;
    expect(velo("Cuarzo blanco y oro")).not.toBe("");
    expect(velo("Cuarzo negro y plata")).not.toBe("");
    expect(velo("Cuarzo blanco y oro")).not.toBe(velo("Cuarzo negro y plata"));
    expect(velo("Aurora")).toBe("");
    // El material claro no se tapa con negro, y su muestra va en tinta oscura.
    expect(velo("Cuarzo blanco y oro")).not.toMatch(/rgba\(12, 12, 15/);
  });

  it("la muestra de un material claro usa tinta oscura; la de uno oscuro, blanca", () => {
    montar();
    const muestra = (nombre: string) =>
      screen.getByRole("radio", { name: nombre }).closest("label")!
        .querySelector<HTMLElement>("span.justify-end")!;
    expect(muestra("Cuarzo blanco y oro").dataset.tinta).toBe("oscura");
    expect(muestra("Cuarzo blanco y oro").firstElementChild!.className).toContain("bg-slate-900/90");
    expect(muestra("Cuarzo negro y plata").dataset.tinta).toBe("clara");
    expect(muestra("Aurora").dataset.tinta).toBe("clara");
  });

  describe("materiales diferidos", () => {
    let disparar: (visible: boolean) => void = () => {};
    const observados: Element[] = [];

    beforeEach(() => {
      observados.length = 0;
      class IOFalso {
        cb: IntersectionObserverCallback;
        constructor(cb: IntersectionObserverCallback) {
          this.cb = cb;
          disparar = (visible) =>
            act(() =>
              this.cb(
                observados.map((target) => ({ isIntersecting: visible, target }) as IntersectionObserverEntry),
                this as unknown as IntersectionObserver,
              ),
            );
        }
        observe(el: Element) { observados.push(el); }
        disconnect() {}
        unobserve() {}
        takeRecords() { return []; }
      }
      vi.stubGlobal("IntersectionObserver", IOFalso);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const muestrasMateriales = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-familia="material"] [data-muestra]'),
      );

    it("pinta un color liso hasta que el grupo entra en pantalla, y luego el material", () => {
      montar();
      const antes = muestrasMateriales();
      expect(antes).toHaveLength(PRESETS_PORTADA.filter((p) => p.familia === "material").length);
      expect(antes.every((m) => m.dataset.muestra === "provisional")).toBe(true);
      expect(antes.some((m) => m.style.background.includes("webp"))).toBe(false);
      // Los grupos de marca no esperan: son baratos y van arriba.
      const aurora = screen.getByRole("radio", { name: "Aurora" }).closest("label")!;
      expect(aurora.querySelector("[data-muestra]")!.getAttribute("data-muestra")).toBe("fondo");

      disparar(false);
      expect(muestrasMateriales().every((m) => m.dataset.muestra === "provisional")).toBe(true);

      disparar(true);
      const despues = muestrasMateriales();
      expect(despues.every((m) => m.dataset.muestra === "fondo")).toBe(true);
      const esperado = document.createElement("div");
      // La tarjeta baja la miniatura, no la portada completa.
      esperado.style.background = fondoPortadaMuestra("mat-cuarzo-blanco", COLOR).background;
      expect(despues.map((m) => m.style.background)).toContain(esperado.style.background);
    });
  });

  it("previsualiza cada fondo con el color del negocio, no con una muestra genérica", () => {
    const { container } = render(
      <SelectorFondoPortada valor={null} onCambiar={vi.fn()} color={COLOR} />
    );
    const estilos = Array.from(container.querySelectorAll<HTMLElement>("span[style]")).map(
      (el) => el.style.background
    );
    const esperado = document.createElement("div");
    esperado.style.background = fondoPortada("deg-aurora", COLOR).background;
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
      <SelectorFondoPortada valor="geo-arcos" onCambiar={vi.fn()} color={COLOR} />
    );
    const elegido = screen.getByRole("radio", { checked: true }) as HTMLInputElement;
    expect(elegido).toBeChecked();
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

  it("una clave guardada se marca tal cual, sin reasignarla", () => {
    montar({ valor: "deg-aurora" });
    expect(screen.getByRole("radio", { checked: true }).closest("label")).toHaveTextContent("Aurora");
  });

  it("una clave desconocida vuelve a la foto si la hay", () => {
    montar({ valor: "no-existe", portadaUrl: "https://cdn.test/p.jpg" });
    expect(screen.getByRole("radio", { checked: true }).closest("label")).toHaveTextContent("Tu foto");
  });

  it("vuelve a la foto al elegir esa opción", async () => {
    const { onCambiar } = montar({ valor: "tex-arena", portadaUrl: "https://cdn.test/p.jpg" });
    await userEvent.click(screen.getByText("Tu foto"));
    expect(onCambiar).toHaveBeenCalledWith(null);
  });
});
