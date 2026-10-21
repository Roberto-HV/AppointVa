// ── Errores de la API ──────────────────────────────────────────────────────────
//
// El backend responde los errores de negocio como `{ mensaje: "..." }`. Cada
// pantalla repetía el mismo cast para leerlo; este es el único sitio que lo hace.

/** Mensaje que manda el backend, o el texto por defecto. */
export function mensajeError(err: unknown, porDefecto: string): string {
  const mensaje = (err as { response?: { data?: { mensaje?: unknown } } })?.response?.data?.mensaje;
  return typeof mensaje === "string" && mensaje.trim() ? mensaje : porDefecto;
}
