import { describe, it, expect } from "vitest";
import { SVG_MATERIALES } from "./portadaMaterialesSvg";

// El dibujo fuente ya no llega al navegador, pero de él salen los WebP: un SVG
// roto o sin semilla produciría una imagen distinta en cada `npm run portadas`.
describe("dibujo fuente de los materiales", () => {
  it("produce un estilo válido: SVG en línea sin red, con semillas fijas", () => {
    for (const construir of Object.values(SVG_MATERIALES)) {
      const fondo = construir();
      expect(fondo.background).not.toMatch(/NaN|undefined|null/);
      expect(fondo.background).toContain('url("data:image/svg+xml,');
      const svgs = (fondo.background.match(/data:image\/svg\+xml,[^"]+/g) ?? []).map((u) =>
        decodeURIComponent(u.slice("data:image/svg+xml,".length)),
      );
      for (const svg of svgs) {
        // XML bien formado: un SVG roto no da error, simplemente no se pinta.
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.documentElement.tagName).toBe("svg");
      }
      // Ninguna petición externa: el único http es el espacio de nombres del SVG.
      const sinNamespace = svgs.join("").replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
      expect(sinNamespace).not.toMatch(/https?:/);
      // Todo ruido lleva semilla: el generador saca siempre la misma imagen.
      const ruidos = sinNamespace.match(/<feTurbulence[^>]*>/g) ?? [];
      expect(ruidos.length).toBeGreaterThan(0);
      for (const r of ruidos) expect(r).toMatch(/seed="\d+"/);
      // Un modo de mezcla por capa, si los hay.
      if (fondo.backgroundBlendMode) {
        const capas = fondo.background.split(/,(?![^(]*\))/).length;
        expect(fondo.backgroundBlendMode.split(",").length).toBeLessThanOrEqual(capas);
      }
    }
  });

  it("deja el pie oscuro fuera de la imagen: lo pone la app en CSS", () => {
    for (const construir of Object.values(SVG_MATERIALES)) {
      expect(construir().background).not.toContain("rgba(8,8,10");
    }
  });
});
