import { describe, expect, it } from "vitest";
import { esFechaValida, leerParamsCitas, PAGINA_MAXIMA } from "./paramsCitas";

const HOY = "2026-10-21";
const GUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const leer = (q: string) => leerParamsCitas(new URLSearchParams(q), HOY);

describe("leerParamsCitas", () => {
  it("sin parámetros usa hoy y la página 1", () => {
    expect(leer("")).toEqual({ desde: HOY, hasta: HOY, empleadoId: "", pagina: 1, dia: HOY, invalidos: [] });
  });

  it("respeta valores válidos y el vacío como 'sin límite'", () => {
    expect(leer(`desde=2026-10-01&hasta=&empleadoId=${GUID}&pagina=3&dia=2026-11-02`)).toEqual({
      desde: "2026-10-01", hasta: "", empleadoId: GUID, pagina: 3, dia: "2026-11-02", invalidos: [],
    });
  });

  it.each(["2026-02-31", "2026-13-45", "", "hoy"])("dia=%s vuelve a hoy y se marca", (d) => {
    const r = leer(`dia=${d}`);
    expect(r.dia).toBe(HOY);
    expect(r.invalidos).toEqual(["dia"]);
  });

  it("fechas mal formadas o imposibles vuelven a hoy y se marcan", () => {
    const r = leer("desde=21/10/2026&hasta=2026-02-31");
    expect(r.desde).toBe(HOY);
    expect(r.hasta).toBe(HOY);
    expect(r.invalidos).toEqual(["desde", "hasta"]);
  });

  it.each(["abc", "0", "-2", "2.5", "1e308", String(PAGINA_MAXIMA + 1)])(
    "pagina=%s se descarta y queda en 1",
    (p) => {
      const r = leer(`pagina=${p}`);
      expect(r.pagina).toBe(1);
      expect(r.invalidos).toEqual(["pagina"]);
    },
  );

  it("un empleadoId que no es GUID se ignora y se marca", () => {
    const r = leer("empleadoId=1%20OR%201=1");
    expect(r.empleadoId).toBe("");
    expect(r.invalidos).toEqual(["empleadoId"]);
  });
});

describe("esFechaValida", () => {
  it("acepta días reales y rechaza el resto", () => {
    expect(esFechaValida("2024-02-29")).toBe(true);
    expect(esFechaValida("2025-02-29")).toBe(false);
    expect(esFechaValida("2026-1-5")).toBe(false);
  });
});
