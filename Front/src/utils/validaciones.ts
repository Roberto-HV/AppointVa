// ── Validaciones de formularios del panel ─────────────────────────────────────
//
// Una sola regla y un solo mensaje para el correo del cliente: Nueva cita,
// Repetir cita y Editar cliente deben aceptar y rechazar lo mismo.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MENSAJE_EMAIL_INVALIDO = "Correo no válido (ej: nombre@dominio.com)";

/** Correo opcional: vacío es válido; si hay texto, debe parecer un correo. */
export function validarEmailCliente(v: string): string {
  const t = v.trim();
  return t && !EMAIL_RE.test(t) ? MENSAJE_EMAIL_INVALIDO : "";
}
