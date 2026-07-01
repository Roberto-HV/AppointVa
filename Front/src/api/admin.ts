import { api } from "./axios";
import type { NegocioDto, CrearNegocioDto, ActualizarColoresNegocioDto } from "../types";

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
};
