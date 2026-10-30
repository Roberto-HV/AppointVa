import { describe, expect, it } from "vitest";
import { aplicarOrden, cambiosDeOrden } from "./ordenServicios";
import type { ServicioDto } from "../types";

const s = (id: string, orden: number, categoriaNombre: string | null = null) =>
  ({ id, nombre: id, orden, categoriaNombre } as unknown as ServicioDto);

describe("cambiosDeOrden (M11)", () => {
  it("reparte los mismos valores de orden y solo cambia los que se movieron", () => {
    const items = [s("a", 2), s("b", 5), s("c", 9)];
    const cambios = cambiosDeOrden(items, 2, 0);
    expect(cambios.map((c) => [c.servicio.id, c.orden])).toEqual([["c", 2], ["a", 5], ["b", 9]]);
  });

  it("con valores repetidos numera desde el menor", () => {
    const items = [s("a", 1), s("b", 1), s("c", 1)];
    const cambios = cambiosDeOrden(items, 0, 1);
    expect(cambios.map((c) => [c.servicio.id, c.orden])).toEqual([["a", 2], ["c", 3]]);
  });

  it("no hace nada fuera de rango o sin movimiento", () => {
    const items = [s("a", 1), s("b", 2)];
    expect(cambiosDeOrden(items, 0, 0)).toEqual([]);
    expect(cambiosDeOrden(items, 1, 2)).toEqual([]);
    expect(cambiosDeOrden(items, -1, 0)).toEqual([]);
  });

  it("aplicarOrden vuelve a ordenar la lista completa sin mover otras categorías de lugar", () => {
    const todos = [s("a", 1, "X"), s("b", 2, "X"), s("z", 3, "Y")];
    const nuevos = aplicarOrden(todos, cambiosDeOrden(todos.slice(0, 2), 1, 0));
    expect(nuevos.map((x) => x.id)).toEqual(["b", "a", "z"]);
  });
});
