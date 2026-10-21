import { describe, it, expect } from "vitest";
import { precioVisible, formatMonto } from "./precios";

describe("precioVisible", () => {
  it("muestra el precio mensual cuando está seleccionado Mensual", () => {
    expect(precioVisible({ mensual: 249, anual: 199 }, false)).toEqual({
      porMes: 249, facturaAnual: false, sinPrecioAnual: false, ahorroAnual: 0,
    });
  });

  it("aplica el precio anual y calcula el ahorro cuando el plan lo tiene", () => {
    expect(precioVisible({ mensual: 249, anual: 199 }, true)).toEqual({
      porMes: 199, facturaAnual: true, sinPrecioAnual: false, ahorroAnual: 600,
    });
  });

  it("marca el plan sin precio anual en lugar de mostrarlo como si nada cambiara", () => {
    const r = precioVisible({ mensual: 449 }, true);
    expect(r.porMes).toBe(449);
    expect(r.facturaAnual).toBe(false);
    expect(r.sinPrecioAnual).toBe(true);
  });

  it("un plan que no se puede contratar no lleva nota de facturación anual", () => {
    const r = precioVisible({ mensual: 799, disponible: false }, true);
    expect(r.sinPrecioAnual).toBe(false);
    expect(r.facturaAnual).toBe(false);
    expect(r.porMes).toBe(799);
  });

  it("no marca nada en Mensual aunque el plan no tenga precio anual", () => {
    expect(precioVisible({ mensual: 449 }, false).sinPrecioAnual).toBe(false);
  });

  it("trata un precio anual igual o mayor al mensual como inexistente", () => {
    expect(precioVisible({ mensual: 449, anual: 449 }, true).sinPrecioAnual).toBe(true);
  });

  it("es consistente para todos los planes con el mismo interruptor", () => {
    const planes = [{ mensual: 249, anual: 199 }, { mensual: 449 }, { mensual: 799 }];
    const r = planes.map((p) => precioVisible(p, true));
    // Cada plan o aplica el anual o queda marcado: ninguno queda "igual sin explicación".
    expect(r.every((x) => x.facturaAnual || x.sinPrecioAnual)).toBe(true);
  });
});

describe("formatMonto", () => {
  it("usa separadores de miles es-MX y sin decimales", () => {
    expect(formatMonto(1234)).toBe("1,234");
    expect(formatMonto(199)).toBe("199");
  });
});

describe("PRECIOS_PLANES (decisión 5, AP-08)", () => {
  it("Pro anual cuesta 382: 15 % menos que 449", async () => {
    const { PRECIOS_PLANES } = await import("./precios");
    expect(PRECIOS_PLANES.pro).toEqual({ mensual: 449, anual: 382 });
    expect(Math.round(PRECIOS_PLANES.pro.mensual * 0.85)).toBe(PRECIOS_PLANES.pro.anual);
    expect(precioVisible(PRECIOS_PLANES.pro, true)).toMatchObject({ porMes: 382, facturaAnual: true, ahorroAnual: 804 });
  });
});
