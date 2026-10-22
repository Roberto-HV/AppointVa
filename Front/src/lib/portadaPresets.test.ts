import { describe, it, expect } from "vitest";
import {
  PRESETS_PORTADA,
  esPresetPortadaValido,
  fondoPortada,
  normalizarPresetPortada,
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

  it("solo ofrece el tinte suave: sin patrones, rayas ni granos", () => {
    expect(PRESETS_PORTADA.map((p) => p.clave)).toEqual(["deg-halo"]);
    for (const preset of PRESETS_PORTADA) {
      const { background } = fondoPortada(preset.clave, MARCA);
      expect(background).not.toMatch(/repeating-linear-gradient|svg/);
    }
  });

  it("reconoce las claves del catálogo y rechaza las demás", () => {
    expect(esPresetPortadaValido("deg-halo")).toBe(true);
    expect(esPresetPortadaValido("deg-aurora")).toBe(false);
    expect(esPresetPortadaValido("no-existe")).toBe(false);
    expect(esPresetPortadaValido(null)).toBe(false);
    expect(esPresetPortadaValido("")).toBe(false);
  });
});

describe("normalizarPresetPortada", () => {
  it("conserva la clave vigente", () => {
    expect(normalizarPresetPortada("deg-halo")).toBe("deg-halo");
  });

  it("lleva los degradados retirados al tinte suave", () => {
    for (const clave of ["deg-aurora", "deg-malla", "deg-amanecer"]) {
      expect(normalizarPresetPortada(clave)).toBe("deg-halo");
    }
  });

  it("devuelve los patrones y texturas retirados a \"sin preset\"", () => {
    for (const clave of ["geo-diagonales", "geo-reticula", "geo-rombos", "geo-arcos", "tex-arena", "tex-niebla", "tex-vetas", "tex-terrazo"]) {
      expect(normalizarPresetPortada(clave)).toBeNull();
    }
  });

  it("trata vacío y desconocido como sin preset", () => {
    expect(normalizarPresetPortada(null)).toBeNull();
    expect(normalizarPresetPortada(undefined)).toBeNull();
    expect(normalizarPresetPortada("")).toBeNull();
    expect(normalizarPresetPortada("no-existe")).toBeNull();
  });
});

describe("fondoPortada", () => {
  it("devuelve siempre lo mismo para la misma clave y el mismo color", () => {
    for (const preset of PRESETS_PORTADA) {
      expect(fondoPortada(preset.clave, MARCA)).toEqual(fondoPortada(preset.clave, MARCA));
    }
  });

  it("deriva un fondo distinto para cada color de marca", () => {
    for (const preset of PRESETS_PORTADA) {
      const indigo = fondoPortada(preset.clave, MARCA).background;
      const dorado = fondoPortada(preset.clave, "#C9A227").background;
      expect(indigo).not.toBe(dorado);
    }
  });

  it("distingue el tinte suave del degradado de marca por defecto", () => {
    expect(fondoPortada("deg-halo", MARCA).background).not.toBe(degradeGradient(MARCA));
  });

  it("una clave retirada se dibuja como su reemplazo, sin reventar", () => {
    expect(fondoPortada("deg-aurora", MARCA)).toEqual(fondoPortada("deg-halo", MARCA));
    expect(fondoPortada("geo-arcos", MARCA)).toEqual({ background: degradeGradient(MARCA) });
    expect(fondoPortada("tex-terrazo", MARCA)).toEqual({ background: degradeGradient(MARCA) });
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
