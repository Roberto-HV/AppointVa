import { describe, it, expect, vi } from "vitest";
import { confirmarEnLote, resumenLote } from "./confirmarEnLote";

describe("confirmarEnLote (DC-30)", () => {
  it("confirma una por una, en orden, y no se detiene ante un fallo", async () => {
    const orden: string[] = [];
    let enCurso = 0;
    let maxEnCurso = 0;
    const confirmar = vi.fn(async (id: string) => {
      enCurso++;
      maxEnCurso = Math.max(maxEnCurso, enCurso);
      orden.push(id);
      await Promise.resolve();
      enCurso--;
      if (id === "b") throw new Error("409");
    });
    const progreso = vi.fn();

    const r = await confirmarEnLote(["a", "b", "c"], confirmar, progreso);

    expect(orden).toEqual(["a", "b", "c"]);
    expect(maxEnCurso).toBe(1);
    expect(r).toEqual({ confirmadas: ["a", "c"], fallidas: ["b"] });
    expect(progreso.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it("resume el resultado en singular y plural", () => {
    expect(resumenLote({ confirmadas: ["a", "b"], fallidas: [] })).toBe("2 confirmadas");
    expect(resumenLote({ confirmadas: ["a"], fallidas: ["b"] })).toBe("1 confirmada, 1 falló");
    expect(resumenLote({ confirmadas: [], fallidas: ["a", "b"] })).toBe("0 confirmadas, 2 fallaron");
  });
});
