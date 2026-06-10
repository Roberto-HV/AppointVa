import { api } from "./axios";
import type { ServicioDto, CategoriaDto, CrearServicioDto } from "../types";

export const serviciosApi = {
  obtenerTodos: async (): Promise<ServicioDto[]> => {
    const { data } = await api.get("/servicios");
    return data;
  },

  crear: async (dto: CrearServicioDto): Promise<ServicioDto> => {
    const { data } = await api.post("/servicios", dto);
    return data;
  },

  actualizar: async (id: string, dto: CrearServicioDto): Promise<ServicioDto> => {
    const { data } = await api.put(`/servicios/${id}`, dto);
    return data;
  },

  eliminar: async (id: string): Promise<void> => {
    await api.delete(`/servicios/${id}`);
  },

  subirImagen: async (id: string, archivo: File): Promise<ServicioDto> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post(`/servicios/${id}/imagen`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};

export const categoriasApi = {
  obtenerTodas: async (): Promise<CategoriaDto[]> => {
    const { data } = await api.get("/categorias");
    return data;
  },

  crear: async (nombre: string, orden: number): Promise<CategoriaDto> => {
    const { data } = await api.post("/categorias", { nombre, orden });
    return data;
  },

  actualizar: async (id: string, nombre: string, orden: number): Promise<CategoriaDto> => {
    const { data } = await api.put(`/categorias/${id}`, { nombre, orden });
    return data;
  },

  eliminar: async (id: string): Promise<void> => {
    await api.delete(`/categorias/${id}`);
  },
};
