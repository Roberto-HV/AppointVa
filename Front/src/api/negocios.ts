import { api } from "./axios";
import type { NegocioDto, ActualizarNegocioDto, HorarioDiaDto, BloqueoNegocioDto } from "../types";
import { configSubida, type OnProgreso } from "../lib/imagenes";

export const negociosApi = {
  obtenerPerfil: async (): Promise<NegocioDto> => {
    const { data } = await api.get("/negocios/perfil");
    return data;
  },

  actualizarPerfil: async (dto: ActualizarNegocioDto): Promise<NegocioDto> => {
    const { data } = await api.put("/negocios/perfil", dto);
    return data;
  },

  subirLogo: async (archivo: File, onProgreso?: OnProgreso): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post("/negocios/perfil/logo", form, configSubida(onProgreso));
    return data;
  },

  subirPortada: async (archivo: File, onProgreso?: OnProgreso): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post("/negocios/perfil/portada", form, configSubida(onProgreso));
    return data;
  },

  subirPoliticas: async (archivo: File, onProgreso?: OnProgreso): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post("/negocios/perfil/politicas", form, configSubida(onProgreso));
    return data;
  },

  eliminarLogo: async (): Promise<void> => {
    await api.delete("/negocios/perfil/logo");
  },

  eliminarPortada: async (): Promise<void> => {
    await api.delete("/negocios/perfil/portada");
  },

  /** B11: guarda solo el punto de enfoque de la portada ("X% Y%"). */
  actualizarPosicionPortada: async (portadaObjectPosition: string): Promise<{ portadaObjectPosition: string }> => {
    const { data } = await api.patch("/negocios/perfil/portada/posicion", { portadaObjectPosition });
    return data;
  },

  eliminarPoliticas: async (): Promise<void> => {
    await api.delete("/negocios/perfil/politicas");
  },

  obtenerHorarios: async (): Promise<HorarioDiaDto[]> => {
    const { data } = await api.get("/negocios/perfil/horarios");
    return data;
  },

  actualizarHorarios: async (horarios: HorarioDiaDto[]): Promise<HorarioDiaDto[]> => {
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

  obtenerGaleria: async (): Promise<ImagenGaleriaItem[]> => {
    const { data } = await api.get("/negocios/galeria");
    return data;
  },

  subirImagenGaleria: async (archivo: File, descripcion?: string, onProgreso?: OnProgreso): Promise<ImagenGaleriaItem> => {
    const form = new FormData();
    form.append("archivo", archivo);
    if (descripcion) form.append("descripcion", descripcion);
    const { data } = await api.post("/negocios/galeria", form, configSubida(onProgreso));
    return data;
  },

  eliminarImagenGaleria: async (id: string): Promise<void> => {
    await api.delete(`/negocios/galeria/${id}`);
  },

  /** B12: todas las fotos de la galería en su nuevo orden (la primera es la que ven primero). */
  reordenarGaleria: async (ids: string[]): Promise<ImagenGaleriaItem[]> => {
    const { data } = await api.patch("/negocios/galeria/reordenar", { ids });
    return data;
  },
};

export interface ImagenGaleriaItem {
  id: string;
  url: string;
  descripcion?: string;
  orden: number;
  fechaCreacion: string;
}
