import { api } from "./axios";
import type { NegocioPublico, SlotDisponible, ConfirmacionCita } from "../types";

export interface ResenaTokenInfo {
  negocioNombre: string;
  servicio: string;
  empleado: string;
  fecha?: string;
}

export interface EnviarResenaDto {
  rating: number;
  comentario?: string;
}

export interface CrearCitaDto {
  negocioSlug: string;
  servicioId: string;
  empleadoId: string;
  inicioEn: string; // ISO datetime
  nombreCliente: string;
  telefonoCliente: string;
  emailCliente?: string;
  notas?: string;
  codigoDescuento?: string;
  respuestasIntake?: { campoIntakeId: string; valor?: string }[];
  /** "Sí, soy yo": reservar como el cliente ya registrado con ese teléfono. */
  confirmarClienteExistente?: boolean;
}

/** Un día de GET /publico/disponibilidad/semana. */
export interface DisponibilidadDia {
  fecha: string; // "YYYY-MM-DD"
  /** "cerrado": día bloqueado o sin horario del negocio ese día de la semana. */
  estado: "con-horarios" | "sin-horarios" | "cerrado";
  horarios: SlotDisponible[];
}

/** Datos de un cliente ya registrado en el negocio, devueltos por la búsqueda por teléfono. */
export interface ClienteConocido {
  nombreCliente: string;
  emailCliente: string | null;
  telefonoCliente: string | null;
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

  /**
   * Disponibilidad de varios días en una sola petición (1–14). Los días anteriores a
   * hoy (en la zona del negocio) no vienen: el servidor recorta el rango a partir de hoy.
   */
  obtenerDisponibilidadSemana: async (
    servicioId: string,
    empleadoId: string | null,
    desde: string, // "YYYY-MM-DD"
    dias = 7
  ): Promise<DisponibilidadDia[]> => {
    const params: Record<string, string | number> = { servicioId, desde, dias };
    if (empleadoId) params.empleadoId = empleadoId;
    const { data } = await api.get("/publico/disponibilidad/semana", { params });
    return data;
  },

  /** 404 cuando el teléfono no corresponde a ningún cliente del negocio. */
  buscarClienteDatos: async (slug: string, telefono: string): Promise<ClienteConocido> => {
    const { data } = await api.get("/publico/cliente", { params: { slug, telefono } });
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

  cancelarCita: async (codigo: string, email?: string): Promise<void> => {
    await api.delete(`/publico/citas/${codigo}`, { params: email ? { email } : undefined });
  },

  reagendarCita: async (codigo: string, inicioEn: string, email?: string): Promise<{ mensaje: string }> => {
    const { data } = await api.patch(
      `/publico/citas/${codigo}/reagendar`,
      { inicioEn },
      { params: email ? { email } : undefined }
    );
    return data;
  },

  obtenerTokenResena: async (token: string): Promise<ResenaTokenInfo> => {
    const { data } = await api.get(`/publico/resenas/${token}`);
    return data;
  },

  enviarResena: async (token: string, dto: EnviarResenaDto): Promise<{ mensaje: string }> => {
    const { data } = await api.post(`/publico/resenas/${token}`, dto);
    return data;
  },
};
