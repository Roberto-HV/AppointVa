import { api } from "./axios";
import type { ServicioDto, CategoriaDto, CrearServicioDto } from "../types";

// El PUT reemplaza el servicio completo: hay que reenviar los campos que no cambian
// o se pierden (un `destacado` ausente llega al backend como false).
async function guardarCampos(s: ServicioDto, cambios: Partial<ServicioDto>): Promise<ServicioDto> {
  const merged = { ...s, ...cambios };
  const { data } = await api.put(`/servicios/${s.id}`, {
    categoriaId: merged.categoriaId || undefined,
    nombre: merged.nombre,
    descripcion: merged.descripcion || undefined,
    duracionMinutos: merged.duracionMinutos,
    bufferMinutos: merged.bufferMinutos,
    precio: merged.precio,
    orden: merged.orden,
    destacado: merged.destacado,
    activo: merged.activo,
  });
  return data;
}

export const serviciosApi = {
  obtenerTodos: async (incluirInactivos = false): Promise<ServicioDto[]> => {
    const { data } = await api.get("/servicios", { params: { incluirInactivos } });
    return data;
  },

  toggleActivo: (s: ServicioDto): Promise<ServicioDto> => guardarCampos(s, { activo: !s.activo }),

  toggleDestacado: (s: ServicioDto): Promise<ServicioDto> => guardarCampos(s, { destacado: !s.destacado }),

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
