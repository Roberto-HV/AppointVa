// ── Posición de un popover anclado ───────────────────────────────────────────

export const MARGEN_POPOVER = 8;

export interface PosicionPopover {
  top: number;
  left: number;
  maxHeight: number;
}

/**
 * Debajo del ancla si cabe, si no arriba; si no cabe en ninguno de los dos,
 * a un lado (derecha o izquierda), como Google Calendar con un bloque de la
 * rejilla; y si tampoco, donde haya más espacio con scroll interno. Arriba y
 * abajo se alinea al borde izquierdo del ancla, o al derecho si se saldría.
 */
export function posicionPopover(
  r: { top: number; bottom: number; left: number; right: number },
  panel: { ancho: number; alto: number },
  vista: { ancho: number; alto: number },
): PosicionPopover {
  const M = MARGEN_POPOVER;
  const ancho = Math.min(panel.ancho, vista.ancho - M * 2);
  let left = r.left;
  if (left + ancho > vista.ancho - M) left = r.right - ancho;
  left = Math.max(M, Math.min(left, vista.ancho - ancho - M));

  const abajo = vista.alto - r.bottom - M * 2;
  const arriba = r.top - M * 2;
  if (panel.alto <= abajo) return { top: r.bottom + M, left, maxHeight: abajo };
  if (panel.alto <= arriba) return { top: r.top - M - panel.alto, left, maxHeight: arriba };

  const altoLado = vista.alto - M * 2;
  const top = Math.max(M, Math.min(r.top, vista.alto - M - Math.min(panel.alto, altoLado)));
  if (r.right + M + ancho <= vista.ancho - M) return { top, left: r.right + M, maxHeight: altoLado };
  if (r.left - M - ancho >= M) return { top, left: r.left - M - ancho, maxHeight: altoLado };

  return abajo >= arriba
    ? { top: r.bottom + M, left, maxHeight: abajo }
    : { top: M, left, maxHeight: arriba };
}
