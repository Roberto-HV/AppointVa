// ── Errores de la API ──────────────────────────────────────────────────────────
//
// El backend responde los errores de negocio como `{ mensaje: "..." }`. Cada
// pantalla repetía el mismo cast para leerlo; este es el único sitio que lo hace.

/** Mensaje que manda el backend, o el texto por defecto. */
export function mensajeError(err: unknown, porDefecto: string): string {
  const mensaje = (err as { response?: { data?: { mensaje?: unknown } } })?.response?.data?.mensaje;
  return typeof mensaje === "string" && mensaje.trim() ? mensaje : porDefecto;
}

/** Código HTTP de un error de axios, o `undefined` si no hubo respuesta. */
export function estadoHttp(err: unknown): number | undefined {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Fallo que puede resolverse solo con reintentar: sin respuesta (red caída),
 * error del servidor (5xx), tiempo agotado (408) o demasiadas peticiones (429).
 * Estas pantallas no deben decir "enlace inválido" ni "verifica tus datos".
 */
export function esErrorTemporal(err: unknown): boolean {
  const status = estadoHttp(err);
  return status === undefined || status >= 500 || status === 408 || status === 429;
}
