import type { NegocioMetricasDto } from "../api/admin";

// ── Negocios pendientes de activación (AP-07) ─────────────────────────────────
//
// El registro público crea el negocio inactivo y sin plan: el SuperAdmin lo
// aprueba y le asigna uno. `NegocioMetricasDto` no trae fecha de registro ni si
// el propietario confirmó su correo (hueco del backend), así que la única señal
// disponible es "inactivo y sin plan". Un negocio desactivado después de tener
// plan no cuenta como pendiente.

export function esPendienteActivacion(n: Pick<NegocioMetricasDto, "activo" | "planNombre" | "planId">): boolean {
  return n.activo !== 1 && !n.planId && !n.planNombre;
}

/** 0 = pendiente de activación, 1 = activo, 2 = desactivado. */
function rango(n: NegocioMetricasDto): number {
  if (esPendienteActivacion(n)) return 0;
  return n.activo === 1 ? 1 : 2;
}

/** Pendientes primero (la tarea más urgente del SuperAdmin), luego activos, luego desactivados. */
export function ordenarNegociosAdmin(a: NegocioMetricasDto, b: NegocioMetricasDto): number {
  return rango(a) - rango(b);
}

// ── Edición de un pago de suscripción (AP-23) ─────────────────────────────────
//
// Antes se guardaba `parseFloat(monto) || 0`: un error al teclear registraba
// $0, y un período "desde" posterior al "hasta" se aceptaba.

export interface EdicionPago {
  monto: string;
  desde: string;
  hasta: string;
}

/** Mensaje del primer problema, o `null` si se puede guardar. */
export function validarEdicionPago({ monto, desde, hasta }: EdicionPago): string | null {
  const valor = Number(monto.trim().replace(",", "."));
  if (!monto.trim() || !Number.isFinite(valor) || valor <= 0) return "El monto debe ser mayor que 0.";
  if (!desde || !hasta) return "Indica el período completo.";
  // Fechas de calendario "AAAA-MM-DD": se comparan como texto, sin zonas horarias.
  if (desde > hasta) return "La fecha \"desde\" no puede ser posterior a \"hasta\".";
  return null;
}

/** Color con el formato que guarda el backend: #RRGGBB. */
export function esColorHexValido(valor: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(valor.trim());
}
