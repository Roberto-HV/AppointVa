import { api } from "./axios";
import type { NegocioDto, CrearNegocioDto, ActualizarColoresNegocioDto } from "../types";

export interface AuditLogDto {
  id: string;
  usuarioId: string | null;
  usuarioEmail: string | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  detalles: string | null;
  ipAddress: string | null;
  fechaEn: string;
  /** Nombre actual del negocio afectado (acciones del admin); null si ya no existe. */
  negocioNombre?: string | null;
}

/**
 * Catálogo de acciones de auditoría que sirve el backend (`AccionesAuditoria`).
 * Es la única fuente del filtro y de las etiquetas de la página de auditoría.
 */
export interface CatalogoAuditoria {
  grupos: { id: string; etiqueta: string }[];
  acciones: { accion: string; etiqueta: string; grupo: string }[];
}

export interface AuditLogsRespuesta {
  total: number;
  pagina: number;
  tamano: number;
  datos: AuditLogDto[];
}

export interface PlanDto {
  id: string;
  nombre: string;
  precioMensual: number;
  maxEmpleados: number;
  maxCitasMes: number;
  /** Asignar este plan enciende el módulo de pagos (regla del backend, `FacturacionAdmin`). */
  habilitaModuloPagos: boolean;
}

/**
 * Lote 5 (I4): el propietario se crea por invitación. El admin no escribe ni ve su
 * contraseña: el propietario la elige desde el enlace que le llega por correo.
 */
export interface CrearPropietarioAdminDto {
  email: string;
  nombre: string;
  apellido: string;
}

export interface RespuestaPropietarioCreado {
  mensaje: string;
  email: string;
  nombreCompleto: string;
  /** false: la cuenta quedó creada pero el correo no salió; se puede reenviar el enlace. */
  invitacionEnviada: boolean;
}

/** Alta de negocio con su propietario opcional en el mismo paso (lote 5, I8). */
export interface CrearNegocioAdminDto extends CrearNegocioDto {
  propietario?: CrearPropietarioAdminDto;
}

export type NegocioCreadoDto = NegocioDto & {
  propietarioEmail?: string | null;
  /** null sin propietario; false si la cuenta se creó pero la invitación no salió. */
  invitacionEnviada?: boolean | null;
};

/** Lote 5 (I3): lo que borraría eliminar el negocio, contado igual que el borrado. */
export interface ImpactoEliminacionDto {
  negocioId: string;
  activo: boolean;
  citasProximas: number;
  citasPasadas: number;
  clientes: number;
  empleados: number;
  servicios: number;
  pagos: number;
  imagenes: number;
  resenas: number;
}

/** Encabezado con la prueba de reautenticación (ver `ReautenticacionService` en el backend). */
export const ENCABEZADO_REAUTENTICACION = "X-Reautenticacion";
const conPrueba = (prueba?: string) => (prueba ? { headers: { [ENCABEZADO_REAUTENTICACION]: prueba } } : undefined);

export interface NegocioMetricasDto {
  id: string;
  nombre: string;
  slug: string;
  activo: number;
  logoUrl?: string;
  email?: string;
  colorPrimario?: string;
  colorSecundario?: string;
  planNombre?: string;
  planId?: string;
  maxCitasMes: number;
  maxEmpleados: number;
  citasMes: number;
  empleadosActivos: number;
  emailsMes: number;
  moduloPagosHabilitado?: boolean;
  esTester?: boolean;
  propietarioEmail?: string;
  propietarioNombre?: string;
  /** B23: fecha de registro (UTC, ISO 8601). */
  fechaCreacion?: string;
  /** B23: el propietario confirmó su correo; `null` si el negocio no tiene propietario. */
  emailConfirmado?: boolean | null;
  /** B20: plan elegido en la landing al registrarse ("basico" | "pro" | "premium"). */
  planSolicitado?: string | null;
}

export interface PagoSuscripcionDto {
  id: string;
  negocioId: string;
  negocioNombre: string;
  registradoPorEmail: string;
  fechaPago: string;
  periodoDesde: string;
  periodoHasta: string;
  mesesPagados: number;
  monto: number;
  notas: string | null;
  numeroPago: number;
}

export interface SuscripcionResumenDto {
  negocioId: string;
  negocioNombre: string;
  negocioSlug: string;
  fechaVencimiento: string | null;
  estado: "Activa" | "PorVencer" | "Vencida" | "SinSuscripcion";
  diasRestantes: number | null;
  totalPagos: number;
  ultimoPago: PagoSuscripcionDto | null;
  // Billing fields
  planNombre: string | null;
  precioBase: number;
  maxEmpleadosBase: number;
  empleadosExtra: number;
  /** Precio de lista del plan asignado más los empleados extra, se pague o no. */
  totalMensual: number;
  /** Precio mensual de cada empleado extra (`FacturacionAdmin.PrecioEmpleadoExtra`). */
  precioEmpleadoExtra: number;
  sector: string;
  // Lote 2 (G3): definidas en el backend (`FacturacionAdmin`).
  esTester: boolean;
  /** Hay un pago que cubre hoy (Activa o Por vencer). */
  suscripcionVigente: boolean;
  /** Acceso de por vida: vigente, pero sin cobro mensual. */
  accesoPermanente: boolean;
  /** Lo que el negocio aporta al ingreso mensual. Filas, pie y KPIs suman esto. */
  ingresoMensual: number;
}

export interface RegistrarPagoDto {
  mesesPagados: number;
  monto: number;
  notas?: string;
}

export interface EditarPagoRequestDto {
  monto: number;
  notas?: string;
  periodoDesde: string; // YYYY-MM-DD
  periodoHasta: string; // YYYY-MM-DD
}

export const adminApi = {
  obtenerNegocios: async (): Promise<NegocioDto[]> => {
    const { data } = await api.get("/negocios");
    return data;
  },

  crearNegocio: async (dto: CrearNegocioAdminDto): Promise<NegocioCreadoDto> => {
    const { data } = await api.post("/negocios", dto);
    return data;
  },

  /** Lote 5 (I8): si ahora se pueden mandar invitaciones por correo (envío encendido y con llave). */
  correoDisponible: async (): Promise<{ envioDisponible: boolean }> => {
    const { data } = await api.get("/negocios/correo-disponible");
    return data;
  },

  activar: async (id: string): Promise<NegocioDto> => {
    const { data } = await api.patch(`/negocios/${id}/activar`);
    return data;
  },

  confirmarEmail: async (id: string): Promise<void> => {
    await api.patch(`/negocios/${id}/confirmar-email`);
  },

  desactivar: async (id: string): Promise<NegocioDto> => {
    const { data } = await api.patch(`/negocios/${id}/desactivar`);
    return data;
  },

  crearPropietario: async (negocioId: string, dto: CrearPropietarioAdminDto): Promise<RespuestaPropietarioCreado> => {
    const { data } = await api.post(`/negocios/${negocioId}/propietario`, dto);
    return data;
  },

  /** Lote 5 (I4): manda al propietario el enlace para elegir su contraseña. Pide reautenticación. */
  enviarEnlaceContrasena: async (
    negocioId: string,
    prueba: string,
  ): Promise<{ mensaje: string; email: string; esInvitacion: boolean }> => {
    const { data } = await api.post(`/negocios/${negocioId}/propietario/enlace-contrasena`, null, conPrueba(prueba));
    return data;
  },

  obtenerImpactoEliminacion: async (negocioId: string): Promise<ImpactoEliminacionDto> => {
    const { data } = await api.get(`/admin/negocios/${negocioId}/impacto`);
    return data;
  },

  actualizarColores: async (id: string, dto: ActualizarColoresNegocioDto): Promise<NegocioDto> => {
    const { data } = await api.patch(`/negocios/${id}/colores`, dto);
    return data;
  },

  /** Archiva (borrado lógico). Pide reautenticación, como el borrado definitivo. */
  eliminar: async (id: string, prueba: string): Promise<void> => {
    await api.delete(`/negocios/${id}`, conPrueba(prueba));
  },

  obtenerPlanes: async (): Promise<PlanDto[]> => {
    const { data } = await api.get("/planes");
    return data;
  },

  obtenerMetricas: async (): Promise<NegocioMetricasDto[]> => {
    const { data } = await api.get("/admin/metricas/negocios");
    return data;
  },

  obtenerAuditLogs: async (params?: {
    pagina?: number;
    tamano?: number;
    accion?: string;
    usuarioId?: string;
    /** B24: parte del correo del usuario, sin distinguir mayúsculas. */
    email?: string;
    /** B24: instante ISO 8601 (incluido). */
    desde?: string;
    /** B24: instante ISO 8601 (excluido). */
    hasta?: string;
    /** Solo las acciones de un grupo del catálogo (p. ej. "administracion"). */
    grupo?: string;
    /** Solo las entradas sobre este negocio (la Actividad de su ficha). */
    negocioId?: string;
  }): Promise<AuditLogsRespuesta> => {
    const { data } = await api.get("/admin/audit", { params });
    return data;
  },

  obtenerCatalogoAuditoria: async (): Promise<CatalogoAuditoria> => {
    const { data } = await api.get("/admin/audit/acciones");
    return data;
  },

  obtenerSuscripciones: async (): Promise<SuscripcionResumenDto[]> => {
    const { data } = await api.get("/admin/suscripciones");
    return data;
  },

  obtenerPagos: async (negocioId: string): Promise<PagoSuscripcionDto[]> => {
    const { data } = await api.get(`/admin/negocios/${negocioId}/pagos`);
    return data;
  },

  /**
   * Un pago que deja acceso permanente (el "De por vida", o varios que se acumulan
   * hasta ahí) pide la prueba de reautenticación; los mensuales normales no.
   */
  registrarPago: async (negocioId: string, dto: RegistrarPagoDto, prueba?: string): Promise<PagoSuscripcionDto> => {
    const { data } = await api.post(`/admin/negocios/${negocioId}/pagos`, dto, conPrueba(prueba));
    return data;
  },

  obtenerPago: async (pagoId: string): Promise<PagoSuscripcionDto> => {
    const { data } = await api.get(`/admin/pagos/${pagoId}`);
    return data;
  },

  toggleModuloPagos: async (negocioId: string, habilitado: boolean): Promise<void> => {
    await api.patch(`/admin/negocios/${negocioId}/modulo-pagos`, { habilitado });
  },

  setEmpleadosExtra: async (negocioId: string, empleadosExtra: number): Promise<void> => {
    await api.patch(`/admin/negocios/${negocioId}/empleados-extra`, { empleadosExtra });
  },

  /**
   * S2: asks for a 60 s single-use ticket (sent with the Authorization header) for the
   * Hangfire dashboard. The ticket is opaque, never a JWT, and dies on first use.
   */
  emitirTicketHangfire: async (): Promise<string> => {
    const { data } = await api.post<{ ticket: string; expiraEnSegundos: number }>("/admin/hangfire/ticket");
    return data.ticket;
  },

  setSector: async (negocioId: string, sector: string): Promise<void> => {
    await api.patch(`/admin/negocios/${negocioId}/sector`, { sector });
  },

  /** Pide la prueba de reautenticación solo si la edición deja acceso permanente. */
  editarPago: async (pagoId: string, dto: EditarPagoRequestDto, prueba?: string): Promise<PagoSuscripcionDto> => {
    const { data } = await api.patch(`/admin/pagos/${pagoId}`, dto, conPrueba(prueba));
    return data;
  },

  eliminarPago: async (pagoId: string): Promise<void> => {
    await api.delete(`/admin/pagos/${pagoId}`);
  },

  setPlan: async (negocioId: string, planId: string | null): Promise<void> => {
    await api.patch(`/admin/negocios/${negocioId}/plan`, { planId });
  },

  /**
   * Fija el modo tester al valor indicado. Con valor absoluto, un "Deshacer" de un
   * aviso viejo o un reintento tras perder la respuesta no puede dejar el estado
   * contrario (sin valor, el backend alterna el actual).
   */
  setTester: async (id: string, esTester: boolean): Promise<{ esTester: boolean }> => {
    const { data } = await api.post(`/admin/negocios/${id}/tester`, null, { params: { esTester } });
    return data;
  },

  /** Borrado definitivo. Pide la prueba de reautenticación (lote 5, G1). */
  eliminarNegocio: async (id: string, prueba: string): Promise<void> => {
    await api.delete(`/admin/negocios/${id}`, conPrueba(prueba));
  },
};
