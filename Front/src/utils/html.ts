// ── Escapado de HTML ───────────────────────────────────────────────────────────
//
// Para los pocos sitios que todavía arman un documento HTML como texto (la
// impresión del corte de caja se escribe en una ventana `about:blank` del mismo
// origen). Cualquier dato que venga del servidor o del usuario —nombre del
// negocio, de un empleado, de un método de pago— pasa por aquí antes de
// interpolarse: sin escapar, un nombre con marcado se ejecutaría en el origen
// de la aplicación.

const ENTIDADES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Convierte cualquier valor en texto seguro para insertarlo en HTML (contenido o atributo entre comillas). */
export function escapeHtml(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}
