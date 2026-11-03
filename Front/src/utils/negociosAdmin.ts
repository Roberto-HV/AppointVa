import type { NegocioMetricasDto, SuscripcionResumenDto } from "../api/admin";
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

// ── Búsqueda en la lista de negocios (lote 4, I1) ─────────────────────────────
//
// Quien llama casi siempre da el correo o el nombre del dueño, no el slug: la
// búsqueda cubre también al propietario y el correo del negocio. Sin distinguir
// mayúsculas ni acentos ("peluqueria" encuentra "Peluquería").

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function coincideBusquedaNegocio(
  n: Pick<NegocioMetricasDto, "nombre" | "slug" | "email" | "propietarioEmail" | "propietarioNombre">,
  termino: string,
): boolean {
  const t = normalizar(termino.trim());
  if (!t) return true;
  return [n.nombre, n.slug, n.email, n.propietarioEmail, n.propietarioNombre]
    .some((campo) => !!campo && normalizar(campo).includes(t));
}

// ── Requiere atención (lote 4, I7) ────────────────────────────────────────────
//
// El trabajo diario del SuperAdmin: activar altas, cobrar y destrabar cuentas.
// Cada motivo es un filtro de la lista. Los de cobro solo cuentan negocios
// activos que no son de prueba: un tester no paga y uno desactivado ya no se
// cobra.

export type MotivoAtencion = "pendientes" | "sinPago" | "porVencer" | "vencidas" | "correoSinVerificar";

export const MOTIVOS_ATENCION: { id: MotivoAtencion; etiqueta: string; descripcion: string }[] = [
  // La descripción sirve igual para la franja (varios) y para la ficha (uno).
  { id: "pendientes", etiqueta: "Pendientes de activación", descripcion: "Registro nuevo en espera de activación" },
  { id: "vencidas", etiqueta: "Suscripción vencida", descripcion: "El último pago ya no cubre hoy" },
  { id: "porVencer", etiqueta: "Por vencer", descripcion: "El pago vigente vence en los próximos días" },
  { id: "sinPago", etiqueta: "Plan sin pago", descripcion: "Plan asignado sin ningún pago registrado" },
  { id: "correoSinVerificar", etiqueta: "Correo sin verificar", descripcion: "El propietario no ha confirmado su correo" },
];

export function esMotivoAtencion(valor: string | null | undefined): valor is MotivoAtencion {
  return MOTIVOS_ATENCION.some((m) => m.id === valor);
}

export function requiereAtencion(
  n: NegocioMetricasDto,
  s: SuscripcionResumenDto | undefined,
  motivo: MotivoAtencion,
): boolean {
  const cobrable = n.activo === 1 && !n.esTester;
  switch (motivo) {
    case "pendientes":
      return esPendienteActivacion(n);
    case "sinPago":
      return cobrable && !!s?.planNombre && s.estado === "SinSuscripcion";
    case "porVencer":
      return cobrable && s?.estado === "PorVencer";
    case "vencidas":
      return cobrable && s?.estado === "Vencida";
    case "correoSinVerificar":
      return n.emailConfirmado === false;
  }
}

export function conteosAtencion(
  negocios: NegocioMetricasDto[],
  suscripcionDe: (id: string) => SuscripcionResumenDto | undefined,
): Record<MotivoAtencion, number> {
  const conteos = { pendientes: 0, sinPago: 0, porVencer: 0, vencidas: 0, correoSinVerificar: 0 };
  for (const n of negocios) {
    const s = suscripcionDe(n.id);
    for (const { id } of MOTIVOS_ATENCION) if (requiereAtencion(n, s, id)) conteos[id]++;
  }
  return conteos;
}

// ── Orden de la tabla de negocios (lote 4, I1) ────────────────────────────────

export type ColumnaNegocios =
  | "nombre" | "propietario" | "plan" | "suscripcion" | "vence" | "citas" | "empleados" | "estado" | "alta";
export type DireccionOrden = "asc" | "desc";

/** Al pulsar una columna por primera vez: texto de la A a la Z; cifras y fechas, lo mayor o lo más reciente primero. */
export const DIRECCION_INICIAL: Record<ColumnaNegocios, DireccionOrden> = {
  nombre: "asc", propietario: "asc", plan: "asc", suscripcion: "asc", vence: "asc",
  citas: "desc", empleados: "desc", estado: "asc", alta: "desc",
};

/** De lo más urgente a lo más tranquilo: un plan sin pago va antes que no tener plan. */
const URGENCIA_SUSCRIPCION: Record<string, number> = {
  Vencida: 0, PorVencer: 1, SinPago: 2, SinSuscripcion: 3, Activa: 4,
};

function valorOrden(
  n: NegocioMetricasDto,
  s: SuscripcionResumenDto | undefined,
  columna: ColumnaNegocios,
): string | number | null {
  switch (columna) {
    case "nombre": return normalizar(n.nombre);
    case "propietario": return n.propietarioEmail ? n.propietarioEmail.toLowerCase() : null;
    case "plan": return n.planNombre ? normalizar(nombrePlan(n.planNombre)) : null;
    case "suscripcion":
      if (!s) return null;
      return URGENCIA_SUSCRIPCION[s.estado === "SinSuscripcion" && s.planNombre ? "SinPago" : s.estado] ?? null;
    case "vence": return s?.fechaVencimiento ? marcaTiempo(s.fechaVencimiento) || null : null;
    case "citas": return n.citasMes;
    case "empleados": return n.empleadosActivos;
    case "estado": return rango(n);
    case "alta": return n.fechaCreacion ? marcaTiempo(n.fechaCreacion) || null : null;
  }
}

/**
 * Ordena por una columna. Los datos que faltan (sin propietario, sin
 * vencimiento…) van siempre al final, en cualquier dirección: lo que se busca al
 * ordenar es lo que sí tiene el dato. A igualdad, por nombre.
 */
export function ordenarPorColumna(
  negocios: NegocioMetricasDto[],
  suscripcionDe: (id: string) => SuscripcionResumenDto | undefined,
  columna: ColumnaNegocios,
  direccion: DireccionOrden,
): NegocioMetricasDto[] {
  const signo = direccion === "asc" ? 1 : -1;
  const conValor = negocios.map((n) => ({ n, v: valorOrden(n, suscripcionDe(n.id), columna) }));
  return conValor
    .sort((a, b) => {
      if (a.v === null || b.v === null) {
        if (a.v === b.v) return a.n.nombre.localeCompare(b.n.nombre, "es");
        return a.v === null ? 1 : -1;
      }
      const cmp = typeof a.v === "number" && typeof b.v === "number"
        ? a.v - b.v
        : String(a.v).localeCompare(String(b.v), "es");
      return cmp !== 0 ? cmp * signo : a.n.nombre.localeCompare(b.n.nombre, "es");
    })
    .map(({ n }) => n);
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
