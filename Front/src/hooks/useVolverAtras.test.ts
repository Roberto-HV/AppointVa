import { describe, it, expect } from "vitest";
import { hayHistorialEnPestana } from "./useVolverAtras";

describe("hayHistorialEnPestana", () => {
  it("solo hay historial a partir de la segunda entrada de BrowserRouter", () => {
    expect(hayHistorialEnPestana(null)).toBe(false);
    expect(hayHistorialEnPestana({})).toBe(false);
    expect(hayHistorialEnPestana({ idx: 0 })).toBe(false);
    expect(hayHistorialEnPestana({ idx: 1, key: "abc" })).toBe(true);
    expect(hayHistorialEnPestana({ idx: "1" })).toBe(false);
  });
});
