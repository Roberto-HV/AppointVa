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
