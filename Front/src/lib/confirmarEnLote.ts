// ── Confirmar varias citas a la vez (decisión 14, DC-30) ───────────────────────
//
// No hay endpoint por lote (B7): se llama al de una cita, UNA POR UNA, para no
// disparar N correos y N escrituras en paralelo contra el backend. Un fallo no
// detiene el resto; al final se informa cuántas se confirmaron y cuáles fallaron.

export interface ResultadoLote {
  confirmadas: string[];
  fallidas: string[];
}

export async function confirmarEnLote(
  ids: readonly string[],
  confirmar: (id: string) => Promise<unknown>,
  onProgreso?: (hechas: number, total: number) => void,
): Promise<ResultadoLote> {
  const confirmadas: string[] = [];
  const fallidas: string[] = [];
  for (const [i, id] of ids.entries()) {
    try {
      await confirmar(id);
      confirmadas.push(id);
    } catch {
      fallidas.push(id);
    }
    onProgreso?.(i + 1, ids.length);
  }
  return { confirmadas, fallidas };
}

/** Texto del aviso final: "3 confirmadas" o "2 confirmadas, 1 falló". */
export function resumenLote({ confirmadas, fallidas }: ResultadoLote): string {
  const ok = `${confirmadas.length} ${confirmadas.length === 1 ? "confirmada" : "confirmadas"}`;
  if (fallidas.length === 0) return ok;
  return `${ok}, ${fallidas.length} ${fallidas.length === 1 ? "falló" : "fallaron"}`;
}
