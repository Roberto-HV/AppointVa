import { describe, it, expect } from "vitest";
import { BASE_MATERIALES, CONSTRUCTORES_MATERIALES } from "./portadaMateriales";

describe("catálogo de materiales", () => {
  it("cada material tiene color base y constructor, y ninguno sobra", () => {
    // Un material sin color base pinta la miniatura vacía mientras carga el SVG;
    // uno sin constructor nunca se dibuja. Las dos tablas deben ir a la par.
    expect(Object.keys(BASE_MATERIALES).sort()).toEqual(
      Object.keys(CONSTRUCTORES_MATERIALES).sort(),
    );
  });
});
