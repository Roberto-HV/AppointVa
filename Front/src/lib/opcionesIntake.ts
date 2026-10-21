// ── Opciones de una pregunta de selección del cuestionario ─────────────────────
//
// Antes se escribían en un solo campo separadas por coma, así que "Sí, pero
// leve" se partía en dos opciones. Ahora se guardan como arreglo JSON, que la
// página de reservas ya sabía leer (`BookingPage`: si trae "[", es JSON). Las
// preguntas antiguas, separadas por coma, se siguen leyendo igual.

export function leerOpciones(raw: string | null | undefined): string[] {
  const texto = (raw ?? "").trim();
  if (!texto) return [];
  if (texto.startsWith("[")) {
    try {
      const lista = JSON.parse(texto);
      if (Array.isArray(lista)) return lista.map((o) => String(o).trim()).filter(Boolean);
    } catch { /* se lee como texto separado por comas */ }
  }
  return texto.split(",").map((o) => o.trim()).filter(Boolean);
}

/** Opciones limpias (sin vacías ni repetidas) como arreglo JSON; `undefined` si no queda ninguna. */
export function serializarOpciones(opciones: string[]): string | undefined {
  const limpias = Array.from(new Set(opciones.map((o) => o.trim()).filter(Boolean)));
  return limpias.length > 0 ? JSON.stringify(limpias) : undefined;
}
