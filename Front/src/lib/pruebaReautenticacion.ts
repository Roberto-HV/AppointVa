// ── Prueba de reautenticación del SuperAdmin (lote 5, G1) ────────────────────
//
// Antes de una acción sensible del SuperAdmin (eliminar un negocio, mandar al
// propietario el enlace de contraseña, registrar un pago de por vida) el backend
// pide una prueba reciente de identidad: contraseña + código de la app. La prueba
// dura 5 minutos y vale solo para la cuenta que la pidió (ver ReautenticacionService).
//
// Se guarda solo en memoria, nunca en localStorage: al recargar la página se
// vuelve a pedir. Mientras siga vigente, varias acciones seguidas no la repiten.
// (No confundir con `reautenticacion.ts`, que es la salida del modo recepción.)

/** Código que manda el backend cuando falta la prueba o ya venció. */
export const CODIGO_REAUTENTICACION_REQUERIDA = "REAUTENTICACION_REQUERIDA";

/** Código que manda el backend si la cuenta aún no tiene la verificación en dos pasos. */
export const CODIGO_2FA_REQUERIDO = "2FA_REQUERIDO";

/** Margen para no mandar una prueba que vence en el camino. */
const MARGEN_MS = 15_000;

let prueba: { token: string; expiraEn: number } | null = null;

export function guardarPrueba(token: string, expiracion: string) {
  const expiraEn = Date.parse(expiracion);
  prueba = { token, expiraEn: Number.isNaN(expiraEn) ? Date.now() + 4 * 60_000 : expiraEn };
}

/** La prueba guardada, si todavía sirve. */
export function pruebaVigente(): string | null {
  if (!prueba || prueba.expiraEn - MARGEN_MS <= Date.now()) return null;
  return prueba.token;
}

export function olvidarPrueba() {
  prueba = null;
}

/** El usuario cerró el paso "Confirma que eres tú" sin confirmar. */
export class ReautenticacionCancelada extends Error {
  constructor() {
    super("Reautenticación cancelada");
    this.name = "ReautenticacionCancelada";
  }
}

export const esCancelacion = (err: unknown): boolean => err instanceof ReautenticacionCancelada;

function codigoError(err: unknown): unknown {
  return (err as { response?: { data?: { codigoError?: unknown } } })?.response?.data?.codigoError;
}

/** El servidor rechazó la acción porque falta la prueba o ya no vale. */
export const esReautenticacionRequerida = (err: unknown): boolean =>
  codigoError(err) === CODIGO_REAUTENTICACION_REQUERIDA;

export const esDosFactoresRequerido = (err: unknown): boolean => codigoError(err) === CODIGO_2FA_REQUERIDO;
