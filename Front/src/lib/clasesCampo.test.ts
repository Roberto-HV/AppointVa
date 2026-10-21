import { describe, expect, it } from "vitest";
import { claseCampo } from "./clasesCampo";

describe("claseCampo (OM-23)", () => {
  it("con error no lleva el borde oscuro neutro, que tapaba el rojo en dark mode", () => {
    const c = claseCampo(true);
    expect(c).toContain("border-red-500");
    expect(c).toContain("dark:border-red-400");
    expect(c).not.toContain("dark:border-slate-600");
  });

  it("sin error usa el borde neutro en los dos temas", () => {
    const c = claseCampo(false, "pr-10");
    expect(c).toContain("border-slate-200");
    expect(c).toContain("dark:border-slate-600");
    expect(c).not.toContain("border-red");
    expect(c.endsWith("pr-10")).toBe(true);
  });
});
