// ── Entrar al modo recepción con confirmación (I6) ────────────────────────────
// Entrar cambia la sesión de este navegador por un token de kiosco (B9): el
// panel queda bloqueado y volver exige la contraseña de la cuenta. Antes bastaba
// un clic; ahora el menú y Citas piden confirmar, y `KioskPage` solo activa el
// modo sola si llega con `recepcionConfirmada` en el estado de la navegación.

export const RUTA_RECEPCION = "/dashboard/kiosk";

/** Estado de navegación que marca la entrada como ya confirmada. */
export interface EstadoRecepcion {
  recepcionConfirmada?: boolean;
}

export function recepcionConfirmada(estado: unknown): boolean {
  return (estado as EstadoRecepcion | null)?.recepcionConfirmada === true;
}
