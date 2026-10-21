import { describe, it, expect } from "vitest";
import { generarHTMLComprobante } from "./comprobanteSuscripcion";
import type { PagoSuscripcionDto } from "../api/admin";

const ATAQUE = "<img src=x onerror=alert(1)>";

const pago: PagoSuscripcionDto = {
  id: "p1",
  negocioId: "n1",
  negocioNombre: "Salón Test",
  registradoPorEmail: "admin@appointva.com",
  fechaPago: "2026-10-20T12:00:00Z",
  periodoDesde: "2026-10-20T12:00:00Z",
  periodoHasta: "2026-11-20T12:00:00Z",
  mesesPagados: 1,
  monto: 499,
  notas: null,
  numeroPago: 7,
};

const parsear = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("generarHTMLComprobante", () => {
  it("muestra folio, negocio y monto", () => {
    const doc = parsear(generarHTMLComprobante(pago));
    expect(doc.body.textContent).toContain("PAGO-007");
    expect(doc.body.textContent).toContain("Salón Test");
    expect(doc.body.textContent).toContain("499");
  });

  it("un nombre de negocio con marcado (registro público) se imprime como texto", () => {
    const doc = parsear(generarHTMLComprobante({ ...pago, negocioNombre: ATAQUE }));
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.body.textContent).toContain(ATAQUE);
  });

  it("las notas y el correo de quien registró también se escapan", () => {
    const doc = parsear(
      generarHTMLComprobante({ ...pago, notas: ATAQUE, registradoPorEmail: "<script>alert(1)</script>" })
    );
    expect(doc.querySelector("img")).toBeNull();
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.body.textContent).toContain(ATAQUE);
  });
});
