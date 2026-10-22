import { describe, it, expect, vi, afterEach } from "vitest";
import {
  NOMBRE_ARCHIVO_CODIGOS,
  descargarCodigosRecuperacion,
  quedanPocosCodigos,
  textoCodigosRecuperacion,
} from "./codigosRecuperacion";

const CODIGOS = ["AAAAA-11111", "BBBBB-22222"];

afterEach(() => vi.restoreAllMocks());

describe("codigosRecuperacion (B8)", () => {
  it("el texto lleva la cuenta, la advertencia de un solo uso y cada código en su línea", () => {
    const texto = textoCodigosRecuperacion(CODIGOS, "dueña@ejemplo.com", new Date(2026, 9, 22));
    const lineas = texto.split("\n");
    expect(lineas).toContain("Cuenta: dueña@ejemplo.com");
    expect(lineas).toContain("AAAAA-11111");
    expect(lineas).toContain("BBBBB-22222");
    expect(texto).toMatch(/una sola vez/);
    expect(texto).toMatch(/22 de octubre de 2026/);
  });

  it("quedan pocos con 3 o menos", () => {
    expect(quedanPocosCodigos(4)).toBe(false);
    expect(quedanPocosCodigos(3)).toBe(true);
    expect(quedanPocosCodigos(0)).toBe(true);
  });

  it("descarga un .txt desde un Blob local, sin red", async () => {
    const crear = vi.fn(() => "blob:local");
    const revocar = vi.fn();
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const fetchEspia = vi.spyOn(globalThis, "fetch");

    descargarCodigosRecuperacion(CODIGOS);

    const blob = (crear.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/plain;charset=utf-8");
    expect(await blob.text()).toContain("BBBBB-22222");
    const ancla = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(ancla.download).toBe(NOMBRE_ARCHIVO_CODIGOS);
    expect(revocar).toHaveBeenCalledWith("blob:local");
    expect(fetchEspia).not.toHaveBeenCalled();
  });
});
