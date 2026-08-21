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
}

export interface CrearPropietarioAdminDto {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
}

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
  totalMensual: number;
  sector: string;
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

  crearNegocio: async (dto: CrearNegocioDto): Promise<NegocioDto> => {
    const { data } = await api.post("/negocios", dto);
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

  crearPropietario: async (negocioId: string, dto: CrearPropietarioAdminDto) => {
    const { data } = await api.post(`/negocios/${negocioId}/propietario`, dto);
    return data;
  },

  actualizarColores: async (id: string, dto: ActualizarColoresNegocioDto): Promise<NegocioDto> => {
    const { data } = await api.patch(`/negocios/${id}/colores`, dto);
    return data;
  },

  eliminar: async (id: string): Promise<void> => {
    await api.delete(`/negocios/${id}`);
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
  }): Promise<AuditLogsRespuesta> => {
    const { data } = await api.get("/admin/audit", { params });
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

  registrarPago: async (negocioId: string, dto: RegistrarPagoDto): Promise<PagoSuscripcionDto> => {
    const { data } = await api.post(`/admin/negocios/${negocioId}/pagos`, dto);
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

  setSector: async (negocioId: string, sector: string): Promise<void> => {
    await api.patch(`/admin/negocios/${negocioId}/sector`, { sector });
  },

  editarPago: async (pagoId: string, dto: EditarPagoRequestDto): Promise<PagoSuscripcionDto> => {
    const { data } = await api.patch(`/admin/pagos/${pagoId}`, dto);
    return data;
  },

  eliminarPago: async (pagoId: string): Promise<void> => {
    await api.delete(`/admin/pagos/${pagoId}`);
  },

  restablecerPasswordPropietario: async (negocioId: string, nuevaPassword: string): Promise<void> => {
    await api.patch(`/negocios/${negocioId}/propietario/password`, { nuevaPassword });
  },

  setPlan: async (negocioId: string, planId: string | null): Promise<void> => {
    await api.patch(`/admin/negocios/${negocioId}/plan`, { planId });
  },

  toggleTester: async (id: string): Promise<{ esTester: boolean }> => {
    const { data } = await api.post(`/admin/negocios/${id}/tester`);
    return data;
  },

  eliminarNegocio: async (id: string): Promise<void> => {
    await api.delete(`/admin/negocios/${id}`);
  },
};
