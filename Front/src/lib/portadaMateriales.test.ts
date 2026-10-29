import { describe, it, expect } from "vitest";
import {
  BASE_MATERIALES,
  CONSTRUCTORES_MATERIALES,
  MINIATURAS_MATERIALES,
  urlMaterial,
} from "./portadaMateriales";
import { SVG_MATERIALES } from "./portadaMaterialesSvg";

// Solo la lista de archivos: el glob perezoso no llega a cargar ninguno.
const GENERADOS = new Set(
  Object.keys(import.meta.glob("../../public/portadas/*.webp")).map((ruta) =>
    ruta.slice(ruta.lastIndexOf("/portadas/")),
  ),
);

describe("catálogo de materiales", () => {
  it("cada material tiene color base, imagen y dibujo fuente, y ninguno sobra", () => {
    // Un material sin color base pinta la portada vacía mientras carga la imagen;
    // uno sin dibujo fuente no tiene de dónde regenerar su WebP.
    const claves = Object.keys(BASE_MATERIALES).sort();
    expect(Object.keys(CONSTRUCTORES_MATERIALES).sort()).toEqual(claves);
    expect(Object.keys(MINIATURAS_MATERIALES).sort()).toEqual(claves);
    expect(Object.keys(SVG_MATERIALES).sort()).toEqual(claves);
  });

  it("cada material tiene sus WebP generados en public/portadas", () => {
    // Si falta alguno, hay que correr `npm run portadas`.
    for (const clave of Object.keys(BASE_MATERIALES)) {
      for (const mini of [false, true]) {
        const url = urlMaterial(clave, mini);
        expect(GENERADOS.has(url), url).toBe(true);
      }
    }
  });

  it("apunta a su imagen sobre el color liso del material", () => {
    for (const [clave, base] of Object.entries(BASE_MATERIALES)) {
      const { background, backgroundBlendMode } = CONSTRUCTORES_MATERIALES[clave]();
      expect(background).toContain(`url("/portadas/${clave}.webp") center / cover no-repeat`);
      // El color liso va al fondo de la pila: es lo que se ve mientras carga.
      expect(background.endsWith(`, ${base}`)).toBe(true);
      expect(background).not.toContain("data:image/svg+xml");
      // Las mezclas (relieve) ya vienen dentro de la imagen.
      expect(backgroundBlendMode).toBeUndefined();

      expect(MINIATURAS_MATERIALES[clave]().background).toContain(
        `url("/portadas/${clave}-mini.webp")`,
      );
    }
  });

  it("los materiales oscuros conservan el pie oscurecido encima de la imagen", () => {
    const { background } = CONSTRUCTORES_MATERIALES["mat-cuarzo-negro"]();
    expect(background.startsWith("linear-gradient(180deg, rgba(8,8,10,0)")).toBe(true);
    expect(CONSTRUCTORES_MATERIALES["mat-cuarzo-blanco"]().background.startsWith("url(")).toBe(true);
  });
});
