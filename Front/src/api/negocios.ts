import { api } from "./axios";
import type { NegocioDto, ActualizarNegocioDto, HorarioDto, BloqueoNegocioDto } from "../types";

export const negociosApi = {
  obtenerPerfil: async (): Promise<NegocioDto> => {
    const { data } = await api.get("/negocios/perfil");
    return data;
  },

  actualizarPerfil: async (dto: ActualizarNegocioDto): Promise<NegocioDto> => {
    const { data } = await api.put("/negocios/perfil", dto);
    return data;
  },

  subirLogo: async (archivo: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post("/negocios/perfil/logo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  subirPortada: async (archivo: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post("/negocios/perfil/portada", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  obtenerHorarios: async (): Promise<HorarioDto[]> => {
    const { data } = await api.get("/negocios/perfil/horarios");
    return data;
  },

  actualizarHorarios: async (horarios: HorarioDto[]): Promise<HorarioDto[]> => {
    const { data } = await api.put("/negocios/perfil/horarios", horarios);
    return data;
  },

  obtenerDiasBloqueados: async (): Promise<BloqueoNegocioDto[]> => {
    const { data } = await api.get("/negocios/dias-bloqueados");
    return data;
  },

  bloquearDia: async (fecha: string, motivo?: string): Promise<BloqueoNegocioDto> => {
    const { data } = await api.post("/negocios/dias-bloqueados", { fecha, motivo });
    return data;
  },

  desbloquearDia: async (id: string): Promise<void> => {
    await api.delete(`/negocios/dias-bloqueados/${id}`);
  },

  actualizarColores: async (colorPrimario: string, colorSecundario?: string): Promise<NegocioDto> => {
    const { data } = await api.patch("/negocios/perfil/colores", { colorPrimario, colorSecundario });
    return data;
  },
};
