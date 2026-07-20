import { api } from "./axios";
import type { CitaDto } from "../types";

export interface FiltrosCitas {
  desde?: string;
  hasta?: string;
  empleadoId?: string;
  busqueda?: string;
  estado?: number;
  pagina?: number;
  tamano?: number;
}

export interface PaginaCitas {
  datos: CitaDto[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface CambiarEstadoDto {
  nuevoEstado: number;
  motivo?: string;
}

export interface CrearCitaFormDto {
  servicioId: string;
  empleadoId: string;
  inicioEn: string;
  nombreCliente: string;
  telefonoCliente: string;
  emailCliente?: string;
  notas?: string;
}

export const METODOS_PAGO = ["Efectivo", "Tarjeta", "Transferencia"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const citasApi = {
  obtenerPorId: async (id: string): Promise<CitaDto> => {
    const { data } = await api.get(`/citas/${id}`);
    return data;
  },

  obtenerTodas: async (filtros?: FiltrosCitas): Promise<PaginaCitas> => {
    const params = filtros ? { ...filtros } : undefined;
    if (params?.hasta && params.hasta.length === 10) {
      params.hasta = `${params.hasta}T23:59:59`;
    }
    const { data, headers } = await api.get("/citas", { params });
    const total = parseInt(headers["x-total-count"] ?? "0", 10);
    return {
      datos: data,
      total,
      pagina: filtros?.pagina ?? 1,
      tamano: filtros?.tamano ?? 50,
    };
  },

  cambiarEstado: async (id: string, dto: CambiarEstadoDto): Promise<CitaDto> => {
    const { data } = await api.patch(`/citas/${id}/estado`, dto);
    return data;
  },

  reagendar: async (id: string, inicioEn: string): Promise<CitaDto> => {
    const { data } = await api.patch(`/citas/${id}/reagendar`, { inicioEn });
    return data;
  },

  marcarPagada: async (id: string, pagada: boolean, metodoPago?: string): Promise<CitaDto> => {
    const { data } = await api.patch(`/citas/${id}/pago`, { pagada, metodoPago });
    return data;
  },

  crear: async (dto: CrearCitaFormDto): Promise<CitaDto> => {
    const { data } = await api.post("/citas", dto);
    return data;
  },

  actualizarNotas: async (id: string, notas: string | null): Promise<CitaDto> => {
    const { data } = await api.patch(`/citas/${id}/notas`, { notas });
    return data;
  },
};

export const ESTADOS = {
  Pendiente: 1,
  Confirmada: 2,
  Completada: 3,
  Cancelada: 4,
  Inasistencia: 5,
} as const;
