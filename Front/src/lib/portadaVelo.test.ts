import { describe, it, expect } from "vitest";
import { PRESETS_PORTADA, presetsPorFamilia } from "./portadaPresets";
import { VELOS_PORTADA, modoPortada, tintaPortada } from "./portadaVelo";

const MATERIALES = presetsPorFamilia("material");

describe("modoPortada", () => {
  it("separa los materiales por tono", () => {
    for (const preset of MATERIALES) {
      expect(modoPortada(preset.clave, false)).toBe(
        preset.tono === "claro" ? "material-claro" : "material-oscuro",
      );
    }
  });

  it("un fondo elegido gana sobre la foto; sin preset decide la foto", () => {
    expect(modoPortada("mat-cuarzo-blanco", true)).toBe("material-claro");
    expect(modoPortada("deg-aurora", true)).toBe("fondo-marca");
    expect(modoPortada(null, true)).toBe("foto");
    expect(modoPortada("no-existe", true)).toBe("foto");
    expect(modoPortada(null, false)).toBe("degradado-marca");
  });
});

describe("velos y tinta", () => {
  it("material claro: tinta oscura y como mucho un velo blanco al 35%", () => {
    const velos = VELOS_PORTADA["material-claro"];
    for (const velo of [velos.portada, velos.vistaPrevia, velos.muestra]) {
      expect(velo).not.toBeNull();
      // Nada de negro: el material se ve entero.
      expect(velo).not.toMatch(/rgba\(12,12,15/);
      const alfas = [...velo!.matchAll(/rgba\(255,255,255,([\d.]+)\)/g)].map((m) => Number(m[1]));
      expect(Math.max(...alfas)).toBeLessThanOrEqual(0.35);
    }
    const tinta = tintaPortada("material-claro");
    expect(tinta.tipo).toBe("oscura");
    expect(tinta.titulo.className).toContain("text-slate-900");
    expect(tinta.anilloFoco).toContain("focus-visible:ring-slate-900");
  });

  it("foto, marca y material oscuro conservan la tinta blanca", () => {
    for (const modo of ["foto", "material-oscuro", "fondo-marca", "degradado-marca"] as const) {
      const tinta = tintaPortada(modo);
      expect(tinta.tipo).toBe("clara");
      expect(tinta.titulo.className).toBe("text-white");
      expect(tinta.anilloFoco).toContain("focus-visible:ring-white");
    }
  });

  it("la foto lleva el velo oscuro fuerte en las tres superficies", () => {
    const { portada, vistaPrevia, muestra } = VELOS_PORTADA.foto;
    for (const velo of [portada, vistaPrevia, muestra]) expect(velo).toMatch(/rgba\(12,12,15,0\.8/);
  });

  it("todos los presets caen en algún modo con sus tres velos definidos", () => {
    for (const preset of PRESETS_PORTADA) {
      const modo = modoPortada(preset.clave, false);
      expect(Object.keys(VELOS_PORTADA[modo]).sort()).toEqual(["muestra", "portada", "vistaPrevia"]);
    }
  });
});
