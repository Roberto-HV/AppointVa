import { describe, it, expect } from "vitest";
import { validarEdicionPago, esColorHexValido, ordenarNegociosAdmin } from "./negociosAdmin";
import type { NegocioMetricasDto } from "../api/admin";

describe("validarEdicionPago (AP-23)", () => {
  const ok = { monto: "449", desde: "2026-01-01", hasta: "2026-01-31" };

  it("acepta un pago con monto positivo y período en orden", () => {
    expect(validarEdicionPago(ok)).toBeNull();
    expect(validarEdicionPago({ ...ok, monto: "449,50" })).toBeNull();
  });

  it("rechaza un monto vacío, cero o que no es número (antes se guardaba $0)", () => {
    expect(validarEdicionPago({ ...ok, monto: "" })).toMatch(/mayor que 0/);
    expect(validarEdicionPago({ ...ok, monto: "0" })).toMatch(/mayor que 0/);
    expect(validarEdicionPago({ ...ok, monto: "44o" })).toMatch(/mayor que 0/);
  });

  it("rechaza un período invertido o incompleto", () => {
    expect(validarEdicionPago({ ...ok, desde: "2026-02-01" })).toMatch(/posterior/);
    expect(validarEdicionPago({ ...ok, hasta: "" })).toMatch(/período completo/);
  });
});

describe("esColorHexValido", () => {
  it("solo acepta #RRGGBB", () => {
    expect(esColorHexValido("#334155")).toBe(true);
    expect(esColorHexValido("#abcdef")).toBe(true);
    expect(esColorHexValido("#33415")).toBe(false);
    expect(esColorHexValido("334155")).toBe(false);
    expect(esColorHexValido("#33415g")).toBe(false);
  });
});

describe("ordenarNegociosAdmin (AP-07, B23)", () => {
  const n = (nombre: string, over: Partial<NegocioMetricasDto>): NegocioMetricasDto => ({
    id: nombre, nombre, slug: nombre, activo: 0, maxCitasMes: 0, maxEmpleados: 0, citasMes: 0,
    empleadosActivos: 0, emailsMes: 0, ...over,
  });

  it("pendientes primero, con el registro más reciente arriba; luego activos y desactivados", () => {
    const lista = [
      n("Activo", { activo: 1, planId: "p" }),
      n("Viejo", { fechaCreacion: "2026-10-01T10:00:00Z" }),
      n("Desactivado", { planId: "p" }),
      n("Nuevo", { fechaCreacion: "2026-10-20T10:00:00Z" }),
      n("SinFecha", {}),
    ];
    expect([...lista].sort(ordenarNegociosAdmin).map((x) => x.nombre))
      .toEqual(["Nuevo", "Viejo", "SinFecha", "Activo", "Desactivado"]);
  });
});