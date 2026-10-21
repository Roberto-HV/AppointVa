import { describe, it, expect } from "vitest";
import {
  esquemaContrasena,
  cumpleReglasContrasena,
  puntajeContrasena,
  traducirErroresIdentity,
  REGLAS_CONTRASENA,
} from "./contrasena";

describe("reglas de contraseña alineadas con Identity (Program.cs)", () => {
  it("rechaza una contraseña sin minúscula, como el servidor (RequireLowercase por defecto)", () => {
    expect(esquemaContrasena.safeParse("CLAVE123").success).toBe(false);
    expect(cumpleReglasContrasena("CLAVE123")).toBe(false);
  });

  it("rechaza sin mayúscula, sin número o con menos de 6 caracteres", () => {
    expect(esquemaContrasena.safeParse("clave123").success).toBe(false);
    expect(esquemaContrasena.safeParse("ClaveSin").success).toBe(false);
    expect(esquemaContrasena.safeParse("Cl4ve").success).toBe(false);
  });

  it("acepta una contraseña que cumple todas las reglas; no exige símbolos", () => {
    expect(esquemaContrasena.safeParse("Clave1").success).toBe(true);
  });

  it("expone las cuatro reglas que se muestran al usuario", () => {
    expect(REGLAS_CONTRASENA.map((r) => r.id)).toEqual(["longitud", "mayuscula", "minuscula", "numero"]);
    const cumplidas = REGLAS_CONTRASENA.filter((r) => r.cumple("abc1")).map((r) => r.id);
    expect(cumplidas).toEqual(["minuscula", "numero"]);
  });
});

describe("puntajeContrasena", () => {
  it("cumplir solo el mínimo no es 'Fuerte'", () => {
    expect(puntajeContrasena("Password1")).toBe(2);
  });

  it("no pasa de 1 si falta una regla", () => {
    expect(puntajeContrasena("CLAVE123456789!")).toBe(1);
  });

  it("sube con longitud y símbolos", () => {
    expect(puntajeContrasena("Password1234")).toBe(3);
    expect(puntajeContrasena("Password1234!")).toBe(4);
    expect(puntajeContrasena("")).toBe(0);
  });
});

describe("traducirErroresIdentity", () => {
  it("traduce las descripciones conocidas y descarta las demás", () => {
    expect(
      traducirErroresIdentity([
        "Passwords must have at least one lowercase ('a'-'z').",
        "Something unexpected",
      ])
    ).toEqual(["La contraseña debe tener al menos una minúscula."]);
  });

  it("devuelve vacío si no hay errores", () => {
    expect(traducirErroresIdentity(undefined)).toEqual([]);
  });
});
