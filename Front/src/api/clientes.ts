import { api } from "./axios";
import type { ClienteDto, ClienteCitaDto } from "../types";

export interface PaginaClientes {
  datos: ClienteDto[];
  total: number;
}

/** Los dos grupos que el servidor sabe listar; "sin visitas" solo se cuenta. */
export type ActividadCliente = "activos" | "inactivos";

export interface ResumenActividad {
  total: number;
  activos: number;
  inactivos: number;
  sinVisitas: number;
}

export const clientesApi = {
  obtenerTodos: async (buscar?: string, pagina = 1, tamano = 30): Promise<PaginaClientes> => {
    const { data, headers } = await api.get("/clientes", {
      params: { ...(buscar ? { buscar } : {}), pagina, tamano },
    });
    return { datos: data, total: parseInt(headers["x-total-count"] ?? "0", 10) };
  },

  // Mismo endpoint que obtenerTodos: el grupo de actividad es un filtro más, y el
  // servidor lo resuelve para que la paginación recorra el directorio completo.
  obtenerPorActividad: async (
    actividad: ActividadCliente,
    dias: number,
    pagina = 1,
    tamano = 30
  ): Promise<PaginaClientes> => {
    const { data, headers } = await api.get("/clientes", {
      params: { actividad, dias, pagina, tamano },
    });
    return { datos: data, total: parseInt(headers["x-total-count"] ?? "0", 10) };
  },

  obtenerResumenActividad: async (dias: number): Promise<ResumenActividad> => {
    const { data } = await api.get("/clientes/resumen-actividad", { params: { dias } });
    return data;
  },

  obtenerPorId: async (id: string): Promise<ClienteDto> => {
    const { data } = await api.get(`/clientes/${id}`);
    return data;
  },

  obtenerCitas: async (id: string): Promise<ClienteCitaDto[]> => {
    const { data } = await api.get(`/clientes/${id}/citas`);
    return data;
  },

  actualizarNotas: async (id: string, notas: string | null): Promise<ClienteDto> => {
    const { data } = await api.patch(`/clientes/${id}/notas`, { notas });
    return data;
  },
};
