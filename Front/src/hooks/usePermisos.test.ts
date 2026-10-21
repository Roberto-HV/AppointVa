import { describe, it, expect } from "vitest";
import { permisosPorRol } from "./usePermisos";

describe("permisosPorRol (DC-14, decisión 2)", () => {
  it("el Empleado no exporta, no revierte, no anula anticipos, no hace corte ni edita clientes", () => {
    expect(permisosPorRol("Empleado")).toEqual({
      esEmpleado: true,
      exportar: false,
      revertirPago: false,
      anularAnticipo: false,
      corteCaja: false,
      editarCliente: false,
    });
  });

  it("el Propietario conserva todo", () => {
    const p = permisosPorRol("Propietario");
    expect(p.esEmpleado).toBe(false);
    expect([p.exportar, p.revertirPago, p.anularAnticipo, p.corteCaja, p.editarCliente].every(Boolean)).toBe(true);
  });
});
