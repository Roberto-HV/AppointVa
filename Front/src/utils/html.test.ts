import { describe, it, expect } from "vitest";
import { escapeHtml } from "./html";

describe("escapeHtml", () => {
  it("escapa los cinco caracteres con significado en HTML", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("convierte null y undefined en cadena vacía y los números en texto", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(450.5)).toBe("450.5");
  });

  it("un nombre con marcado se muestra como texto y no crea elementos", () => {
    const nombre = "<img src=x onerror=alert(1)>";
    const contenedor = document.createElement("div");
    contenedor.innerHTML = `<p>${escapeHtml(nombre)}</p>`;
    expect(contenedor.querySelector("img")).toBeNull();
    expect(contenedor.textContent).toBe(nombre);
  });
});
