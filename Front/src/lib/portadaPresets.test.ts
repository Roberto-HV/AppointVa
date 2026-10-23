import { describe, it, expect } from "vitest";
import {
  FAMILIAS_PORTADA,
  PRESETS_PORTADA,
  esPresetPortadaValido,
  fondoPortada,
  normalizarPresetPortada,
  presetsPorFamilia,
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
