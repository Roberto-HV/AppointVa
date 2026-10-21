import { describe, it, expect } from "vitest";
import { COLORES_CATEGORIA, colorCategoria } from "./temaGraficas";

describe("paleta categórica (DC-20)", () => {
  it("sale de los tokens --categoria-1…8, sin hex sueltos", () => {
    expect(COLORES_CATEGORIA).toHaveLength(8);
    COLORES_CATEGORIA.forEach((c, i) => expect(c).toBe(`var(--categoria-${i + 1})`));
  });

  it("da un color estable por posición y vuelve a empezar tras el 8", () => {
    expect(colorCategoria(0)).toBe("var(--categoria-1)");
    expect(colorCategoria(7)).toBe("var(--categoria-8)");
    expect(colorCategoria(8)).toBe("var(--categoria-1)");
    expect(colorCategoria(-1)).toBe("var(--categoria-8)");
  });
});
