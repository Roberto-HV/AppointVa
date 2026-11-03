import type { SuscripcionResumenDto } from "../../../api/admin";
import { formatFechaCorta } from "../../../utils/formatters";

/** Orden de Facturación: lo que hay que cobrar primero. */
export const ESTADO_ORDER: Record<string, number> = {
  Vencida: 0, PorVencer: 1, Activa: 2, SinSuscripcion: 3
};

export const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  Activa: { label: 'Activa', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  PorVencer: { label: 'Por vencer', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  Vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  SinSuscripcion: { label: 'Sin suscripción', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  // Con plan asignado pero sin pago: no es lo mismo que no tener plan (G3).
  SinPago: { label: 'Sin pago registrado', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
};

export const LIFETIME_SENTINEL = 1200;

/**
 * Umbral a partir del cual la vigencia deja de ser un dato y pasa a ser
 * "permanente".
 *
 * "De por vida" se registra como un pago de 1200 meses y el backend fija el
 * vencimiento en `periodoDesde.AddMonths(1200)`, es decir cien años. Por eso
 * `diasRestantes` llegaba al badge como 37160 y se pintaba "Activa · 37160d":
 * el dato es correcto, lo que no se sostiene es mostrarlo en días. Cincuenta
 * años deja margen de sobra sobre cualquier suscripción real sin acercarse al
 * centenar del centinela.
 */
export const DIAS_DE_POR_VIDA = 365 * 50;

/** Vigencia restante en la unidad que se pueda leer de un vistazo. */
export function formatVigencia(dias: number): string {
  if (dias >= DIAS_DE_POR_VIDA) return "de por vida";
  if (dias >= 365) {
    const anios = Math.floor(dias / 365);
    return `${anios} año${anios === 1 ? "" : "s"}`;
  }
  if (dias >= 60) return `${Math.round(dias / 30)} meses`;
  return `${dias} d`;
}

/** Insignia de una fila de Facturación: un plan sin pago no es "Sin suscripción" (G3). */
export function badgeFacturacion(s: SuscripcionResumenDto) {
  return s.estado === 'SinSuscripcion' && s.planNombre
    ? ESTADO_BADGE.SinPago
    : ESTADO_BADGE[s.estado] ?? ESTADO_BADGE.SinSuscripcion;
}

/** Vencimiento legible: un acceso de por vida vence el año 2126, la fecha es cierta y no dice nada. */
export function textoVence(s: SuscripcionResumenDto): string {
  if ((s.diasRestantes ?? 0) >= DIAS_DE_POR_VIDA) return 'De por vida';
  return s.fechaVencimiento ? formatFechaCorta(s.fechaVencimiento) : '—';
}
