import { describe, expect, it, vi } from "vitest";
import { configSubida, MAX_MB_IMAGEN, validarImagen } from "./imagenes";

const archivo = (nombre: string, tipo: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], nombre, { type: tipo });

describe("validarImagen", () => {
  it("acepta los formatos del backend", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(validarImagen(archivo("a", tipo))).toBeNull();
    }
  });

  it("rechaza HEIC y no imágenes, nombrando el archivo", () => {
    expect(validarImagen(archivo("foto.heic", "image/heic"))).toBe('"foto.heic" no es JPG, PNG, WebP o GIF.');
    expect(validarImagen(archivo("doc.pdf", "application/pdf"))).toMatch(/doc\.pdf/);
  });

  it("rechaza archivos sobre el límite diciendo cuánto pesan y cuál es el límite", () => {
    const grande = archivo("grande.jpg", "image/jpeg");
    Object.defineProperty(grande, "size", { value: 25 * 1024 * 1024 });
    expect(validarImagen(grande)).toBe(`"grande.jpg" pesa 25.0 MB; el límite es ${MAX_MB_IMAGEN} MB.`);
  });
});

describe("configSubida", () => {
  it("traduce el avance de axios a porcentaje", () => {
    const onProgreso = vi.fn();
    const config = configSubida(onProgreso);
    config.onUploadProgress?.({ loaded: 50, total: 200, bytes: 50, lengthComputable: true });
    expect(onProgreso).toHaveBeenCalledWith(25);
  });

  it("sin total informa null (indeterminado) en vez de 0 %", () => {
    const onProgreso = vi.fn();
    configSubida(onProgreso).onUploadProgress?.({ loaded: 50, total: undefined, bytes: 50, lengthComputable: false });
    expect(onProgreso).toHaveBeenCalledWith(null);
  });

  it("sin callback no registra avance", () => {
    expect(configSubida().onUploadProgress).toBeUndefined();
  });
});
