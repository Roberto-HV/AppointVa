import { api } from "./axios";
import type { NegocioPublico, SlotDisponible, ConfirmacionCita } from "../types";

export interface CrearCitaDto {
  negocioSlug: string;
  servicioId: string;
  empleadoId: string;
  inicioEn: string; // ISO datetime
  nombreCliente: string;
  telefonoCliente: string;
  emailCliente?: string;
  notas?: string;
}

export const publicoApi = {
  obtenerNegocio: async (slug: string): Promise<NegocioPublico> => {
    const { data } = await api.get(`/publico/negocios/${slug}`);
    return data;
  },

  obtenerDisponibilidad: async (
    servicioId: string,
    empleadoId: string | null,
    fecha: string // "YYYY-MM-DD"
  ): Promise<SlotDisponible[]> => {
    const params: Record<string, string> = { servicioId, fecha };
    if (empleadoId) params.empleadoId = empleadoId;
    const { data } = await api.get("/publico/disponibilidad", { params });
    return data;
  },

  crearCita: async (dto: CrearCitaDto): Promise<ConfirmacionCita> => {
    const { data } = await api.post("/publico/citas", dto);
    return data;
  },

  obtenerCita: async (codigo: string): Promise<ConfirmacionCita> => {
    const { data } = await api.get(`/publico/citas/${codigo}`);
    return data;
  },

  cancelarCita: async (codigo: string): Promise<void> => {
    await api.delete(`/publico/citas/${codigo}`);
  },
};
