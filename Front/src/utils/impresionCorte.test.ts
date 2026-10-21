import { describe, it, expect } from "vitest";
import { htmlCorteCaja, type DatosImpresionCorte } from "./impresionCorte";

const ATAQUE = "<img src=x onerror=alert(1)>";

const base: DatosImpresionCorte = {
  negocio: "Salón Test",
  fechaLegible: "martes, 20 de octubre de 2026",
  citasAtendidas: 3,
  totalCobrado: 450,
  totalPropinas: 20,
  porMetodo: [{ etiqueta: "Efectivo", cantidad: 3, monto: 450 }],
  porEmpleado: [{ etiqueta: "Ana López", cantidad: 3, monto: 450 }],
};

function parsear(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("htmlCorteCaja", () => {
  it("muestra el nombre del negocio, los totales y las filas", () => {
    const doc = parsear(htmlCorteCaja(base));
    expect(doc.body.textContent).toContain("Salón Test");
    expect(doc.body.textContent).toContain("$450.00");
    expect(doc.body.textContent).toContain("Ana López");
    expect(doc.body.textContent).toContain("$20.00");
  });

  it("un nombre de negocio con marcado se imprime como texto", () => {
    const doc = parsear(htmlCorteCaja({ ...base, negocio: ATAQUE }));
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.body.textContent).toContain(ATAQUE);
  });

  it("un nombre de empleado o método con marcado se imprime como texto", () => {
    const doc = parsear(
      htmlCorteCaja({
        ...base,
        porEmpleado: [{ etiqueta: ATAQUE, cantidad: 1, monto: 100 }],
        porMetodo: [{ etiqueta: `"><script>alert(1)</script>`, cantidad: 1, monto: 100 }],
      })
    );
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.body.textContent).toContain(ATAQUE);
  });
});
