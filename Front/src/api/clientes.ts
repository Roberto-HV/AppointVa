import { api } from "./axios";
import type { ClienteDto, ClienteCitaDto } from "../types";

export interface PaginaClientes {
  datos: ClienteDto[];
  total: number;
}

export const clientesApi = {
  obtenerTodos: async (buscar?: string, pagina = 1, tamano = 30): Promise<PaginaClientes> => {
    const { data, headers } = await api.get("/clientes", {
      params: { ...(buscar ? { buscar } : {}), pagina, tamano },
    });
    return { datos: data, total: parseInt(headers["x-total-count"] ?? "0", 10) };
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
