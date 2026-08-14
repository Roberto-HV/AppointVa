import { api } from "./axios";

export interface EstadoEncuesta {
  mostrar: boolean;
}

export interface ResponderDto {
  rating: number;
  comentario?: string;
}

export const encuestaApi = {
  obtenerEstado: async (): Promise<EstadoEncuesta> => {
    const { data } = await api.get("/encuesta/estado");
    return data;
  },

  responder: async (dto: ResponderDto): Promise<void> => {
    await api.post("/encuesta/responder", dto);
  },

  posponer: async (): Promise<void> => {
    await api.post("/encuesta/posponer");
  },

  rechazar: async (): Promise<void> => {
    await api.post("/encuesta/rechazar");
  },
};
