import { describe, it, expect } from "vitest";
import {
  FAMILIAS_PORTADA,
  PRESETS_PORTADA,
  esPresetPortadaValido,
  fondoPortada,
  normalizarPresetPortada,
  presetsPorFamilia,
  tonoPortada,
} from "./portadaPresets";
import { degradeGradient } from "./colorUtils";

const MARCA = "#6366f1";

describe("catálogo de fondos de portada", () => {
  it("no repite claves ni nombres", () => {
    const claves = PRESETS_PORTADA.map((p) => p.clave);
    const nombres = PRESETS_PORTADA.map((p) => p.nombre);
    expect(new Set(claves).size).toBe(claves.length);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("agrupa todos los presets en las familias declaradas", () => {
    const agrupados = FAMILIAS_PORTADA.flatMap((f) => presetsPorFamilia(f.familia));
    expect(agrupados).toHaveLength(PRESETS_PORTADA.length);
  });

  it("reconoce las claves del catálogo y rechaza las demás", () => {
    expect(esPresetPortadaValido("deg-aurora")).toBe(true);
    expect(esPresetPortadaValido("no-existe")).toBe(false);
    expect(esPresetPortadaValido(null)).toBe(false);
    expect(esPresetPortadaValido("")).toBe(false);
  });
});

describe("normalizarPresetPortada", () => {
  it("conserva todas las claves del catálogo, sin reasignarlas", () => {
    for (const preset of PRESETS_PORTADA) {
      expect(normalizarPresetPortada(preset.clave)).toBe(preset.clave);
    }
  });

  it("ofrece otra vez degradados, patrones y texturas", () => {
    for (const clave of ["deg-aurora", "deg-malla", "deg-amanecer", "geo-diagonales", "geo-reticula", "geo-rombos", "geo-arcos", "tex-arena", "tex-niebla", "tex-vetas", "tex-terrazo"]) {
      expect(esPresetPortadaValido(clave)).toBe(true);
    }
  });

  it("trata vacío y desconocido como sin preset", () => {
    expect(normalizarPresetPortada(null)).toBeNull();
    expect(normalizarPresetPortada(undefined)).toBeNull();
    expect(normalizarPresetPortada("")).toBeNull();
    expect(normalizarPresetPortada("no-existe")).toBeNull();
  });
});

describe("fondoPortada — caché", () => {
  it("devuelve la misma referencia para la misma clave y el mismo color", () => {
    for (const preset of PRESETS_PORTADA) {
      expect(fondoPortada(preset.clave, MARCA)).toBe(fondoPortada(preset.clave, MARCA));
    }
    expect(fondoPortada(null, MARCA)).toBe(fondoPortada(null, MARCA));
  });

  it("un material no depende del color: misma referencia con cualquier marca", () => {
    expect(fondoPortada("mat-cuarzo-blanco", MARCA)).toBe(fondoPortada("mat-cuarzo-blanco", "#C9A227"));
  });

  it("un fondo de marca sí se separa por color", () => {
    const indigo = fondoPortada("deg-aurora", MARCA);
    const dorado = fondoPortada("deg-aurora", "#C9A227");
    expect(indigo).not.toBe(dorado);
    expect(fondoPortada(null, MARCA)).not.toBe(fondoPortada(null, "#C9A227"));
  });

  it("el objeto compartido está congelado", () => {
    expect(Object.isFrozen(fondoPortada("deg-aurora", MARCA))).toBe(true);
  });
});

describe("fondoPortada", () => {
  it("devuelve siempre lo mismo para la misma clave y el mismo color", () => {
    for (const preset of PRESETS_PORTADA) {
      expect(fondoPortada(preset.clave, MARCA)).toEqual(fondoPortada(preset.clave, MARCA));
    }
  });

  it("deriva un fondo distinto para cada color de marca", () => {
    for (const preset of PRESETS_PORTADA.filter((p) => p.familia !== "material")) {
      const indigo = fondoPortada(preset.clave, MARCA).background;
      const dorado = fondoPortada(preset.clave, "#C9A227").background;
      expect(indigo).not.toBe(dorado);
    }
  });

  it("produce un fondo distinto por preset con el mismo color", () => {
    const fondos = PRESETS_PORTADA.map((p) => fondoPortada(p.clave, MARCA).background);
    expect(new Set(fondos).size).toBe(PRESETS_PORTADA.length);
  });

  it("no deja hex ni NaN sueltos en el CSS generado", () => {
    for (const preset of PRESETS_PORTADA) {
      const { background } = fondoPortada(preset.clave, MARCA);
      expect(background).not.toMatch(/NaN|undefined/);
      // El color de marca entra como hsl() derivado, nunca como el hex crudo.
      expect(background.toLowerCase()).not.toContain(MARCA);
    }
  });

  it("degrada al degradado de marca con una clave desconocida", () => {
    expect(fondoPortada("preset-que-ya-no-existe", MARCA)).toEqual({
      background: degradeGradient(MARCA),
    });
  });

  it("degrada al degradado de marca sin clave", () => {
    const esperado = { background: degradeGradient(MARCA) };
    expect(fondoPortada(null, MARCA)).toEqual(esperado);
    expect(fondoPortada(undefined, MARCA)).toEqual(esperado);
    expect(fondoPortada("", MARCA)).toEqual(esperado);
  });

  it("no revienta sin color de marca", () => {
    for (const preset of PRESETS_PORTADA) {
      const { background } = fondoPortada(preset.clave, "");
      expect(background).toBeTruthy();
      expect(background).not.toMatch(/NaN|undefined/);
    }
  });
});

describe("materiales", () => {
  const MATERIALES = presetsPorFamilia("material");

  it("ofrece la familia con claves estables con prefijo propio", () => {
    expect(MATERIALES.length).toBeGreaterThanOrEqual(10);
    for (const preset of MATERIALES) {
      expect(preset.clave).toMatch(/^mat-[a-z0-9-]+$/);
      // El backend acepta hasta 40 caracteres en minúsculas, dígitos y guiones.
      expect(preset.clave.length).toBeLessThanOrEqual(40);
    }
  });

  it("cada material declara si es claro u oscuro", () => {
    for (const preset of MATERIALES) {
      expect(["claro", "oscuro"]).toContain(preset.tono);
      expect(tonoPortada(preset.clave)).toBe(preset.tono);
    }
    // Hay de los dos tonos: el velo del texto tiene que cubrir ambos casos.
    expect(new Set(MATERIALES.map((p) => p.tono))).toEqual(new Set(["claro", "oscuro"]));
  });

  it("sin preset, con uno desconocido o con los de marca, el tono es oscuro", () => {
    expect(tonoPortada(null)).toBe("oscuro");
    expect(tonoPortada("no-existe")).toBe("oscuro");
    expect(tonoPortada("deg-aurora")).toBe("oscuro");
  });

  it("tiene colores propios: el color de marca no cambia el fondo", () => {
    for (const preset of MATERIALES) {
      expect(fondoPortada(preset.clave, MARCA)).toEqual(fondoPortada(preset.clave, "#C9A227"));
    }
  });

  it("produce un estilo válido: SVG en línea sin red, con semillas fijas", () => {
    for (const preset of MATERIALES) {
      const fondo = fondoPortada(preset.clave, MARCA);
      expect(fondo.background).not.toMatch(/NaN|undefined|null/);
      expect(fondo.background).toContain('url("data:image/svg+xml,');
      // Ninguna petición externa: el único http es el espacio de nombres del SVG.
      const svgs = (fondo.background.match(/data:image\/svg\+xml,[^"]+/g) ?? []).map((u) =>
        decodeURIComponent(u.slice("data:image/svg+xml,".length)),
      );
      for (const svg of svgs) {
        // XML bien formado: un SVG roto no da error, simplemente no se pinta.
        const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
        expect(doc.querySelector("parsererror")).toBeNull();
        expect(doc.documentElement.tagName).toBe("svg");
      }
      const sinNamespace = svgs.join("").replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, "");
      expect(sinNamespace).not.toMatch(/https?:/);
      // Todo ruido lleva semilla: se ve igual en cualquier navegador y visita.
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

  it("cada SVG es ligero: menos de 6 KB codificado", () => {
    for (const preset of MATERIALES) {
      const { background } = fondoPortada(preset.clave, MARCA);
      const urls = background.match(/url\("data:image\/svg\+xml,[^"]+"\)/g) ?? [];
      for (const u of urls) expect(u.length).toBeLessThan(6 * 1024);
    }
  });
});
