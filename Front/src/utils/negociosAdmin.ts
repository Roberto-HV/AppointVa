import type { NegocioMetricasDto, PlanDto, SuscripcionResumenDto } from "../api/admin";
import { esClavePlan, NOMBRES_PLANES } from "../lib/precios";

// ── Cifras de facturación (lote 2, G3) ────────────────────────────────────────
//
// "Plan asignado" (lo que el negocio puede usar) no es dinero: solo una
// suscripción vigente de un negocio que paga entra al ingreso. El backend fija
// `ingresoMensual` por negocio; aquí solo se suma, y la tira de KPIs y el pie de
// Facturación leen el mismo resumen para que no puedan contradecirse.

export interface ResumenFacturacion {
  /** Negocios activos con un plan asignado, se pague o no. */
  conPlanAsignado: number;
  /** De esos, los que tienen un pago que cubre hoy. */
  conSuscripcionVigente: number;
  /** Suma de `ingresoMensual`: lo que entra cada mes. */
  ingresoMensual: number;
}

/** Los negocios de prueba no son clientes: no cuentan en ninguna cifra. */
export function resumenFacturacion(suscripciones: SuscripcionResumenDto[]): ResumenFacturacion {
  const clientes = suscripciones.filter((s) => !s.esTester);
  return {
    conPlanAsignado: clientes.filter((s) => s.planNombre !== null).length,
    conSuscripcionVigente: clientes.filter((s) => s.planNombre !== null && s.suscripcionVigente).length,
    ingresoMensual: clientes.reduce((suma, s) => suma + s.ingresoMensual, 0),
  };
}

/** Por qué una fila no aporta al ingreso mensual, o `null` si aporta. */
export function motivoSinIngreso(s: SuscripcionResumenDto): string | null {
  if (s.ingresoMensual > 0) return null;
  if (!s.planNombre) return "Sin plan asignado";
  if (s.accesoPermanente) return "Acceso de por vida: no tiene cobro mensual";
  if (s.estado === "Vencida") return "Suscripción vencida: no cuenta en el ingreso";
  if (!s.suscripcionVigente) return "Sin pago registrado: no cuenta en el ingreso";
  return "No cuenta en el ingreso";
}

/**
 * Nombre del plan para mostrar (M6): en la BD el plan se llama "Basico", sin
 * acento. Si coincide con un plan conocido se usa su nombre comercial.
 */
export function nombrePlan(nombre: string | null | undefined): string {
  if (!nombre) return "";
  const clave = nombre.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
  return esClavePlan(clave) ? NOMBRES_PLANES[clave] : nombre;
}

/**
 * Mismo criterio que `SuscripcionAdminController.SetPlan`: al asignar un plan,
 * el módulo de pagos queda habilitado solo si su nombre contiene "Pro". Se usa
 * para avisarlo en la confirmación del cambio de plan.
 */
export function planHabilitaModuloPagos(plan: Pick<PlanDto, "nombre">): boolean {
  return plan.nombre.toLowerCase().includes("pro");
}

// ── Negocios pendientes de activación (AP-07) ─────────────────────────────────
//
// El registro público crea el negocio inactivo y sin plan: el SuperAdmin lo
// aprueba y le asigna uno. Pendiente = "inactivo y sin plan"; un negocio
// desactivado después de tener plan no cuenta. `fechaCreacion` (B23) ordena la
// cola con el registro más reciente primero.

export function esPendienteActivacion(n: Pick<NegocioMetricasDto, "activo" | "planNombre" | "planId">): boolean {
  return n.activo !== 1 && !n.planId && !n.planNombre;
}

/** 0 = pendiente de activación, 1 = activo, 2 = desactivado. */
function rango(n: NegocioMetricasDto): number {
  if (esPendienteActivacion(n)) return 0;
  return n.activo === 1 ? 1 : 2;
}

function marcaTiempo(fecha?: string): number {
  const t = fecha ? Date.parse(fecha) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Pendientes primero (la tarea más urgente del SuperAdmin), luego activos, luego
 * desactivados. Entre los pendientes, el registro más reciente primero (B23); el
 * resto conserva el orden del servidor (por nombre).
 */
export function ordenarNegociosAdmin(a: NegocioMetricasDto, b: NegocioMetricasDto): number {
  const porRango = rango(a) - rango(b);
  if (porRango !== 0 || rango(a) !== 0) return porRango;
  return marcaTiempo(b.fechaCreacion) - marcaTiempo(a.fechaCreacion);
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
