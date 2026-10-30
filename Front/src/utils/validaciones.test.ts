import { describe, expect, it } from "vitest";
import { MENSAJE_EMAIL_INVALIDO, validarEmailCliente } from "./validaciones";

describe("validarEmailCliente", () => {
  it("el correo es opcional: vacío o solo espacios es válido", () => {
    expect(validarEmailCliente("")).toBe("");
    expect(validarEmailCliente("   ")).toBe("");
  });

  it("acepta un correo con dominio y extensión, ignorando espacios alrededor", () => {
    expect(validarEmailCliente(" ana@dominio.com ")).toBe("");
  });

  it.each(["ana", "ana@dominio", "ana@dominio.c", "ana @dominio.com"])("rechaza %s con el mensaje común", (v) => {
    expect(validarEmailCliente(v)).toBe(MENSAJE_EMAIL_INVALIDO);
  });
});
