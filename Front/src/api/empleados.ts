import { api } from "./axios";
import type { EmpleadoDto, CrearEmpleadoDto, HorarioDto, BloqueoDto } from "../types";

export const empleadosApi = {
  obtenerTodos: async (incluirInactivos = false): Promise<EmpleadoDto[]> => {
    const { data } = await api.get("/empleados", { params: { incluirInactivos } });
    return data;
  },

  crear: async (dto: CrearEmpleadoDto): Promise<EmpleadoDto> => {
    const { data } = await api.post("/empleados", dto);
    return data;
  },

  actualizar: async (id: string, dto: CrearEmpleadoDto): Promise<EmpleadoDto> => {
    const { data } = await api.put(`/empleados/${id}`, dto);
    return data;
  },

  eliminar: async (id: string): Promise<void> => {
    await api.delete(`/empleados/${id}`);
  },

  invitar: async (id: string, email: string, password: string): Promise<void> => {
    await api.post(`/empleados/${id}/invitar`, { email, password });
  },

  revocarAcceso: async (id: string): Promise<void> => {
    await api.delete(`/empleados/${id}/invitar`);
  },

  obtenerHorario: async (id: string): Promise<HorarioDto[]> => {
    const { data } = await api.get(`/empleados/${id}/horario`);
    return data;
  },

  actualizarHorario: async (id: string, horarios: HorarioDto[]): Promise<void> => {
    await api.put(`/empleados/${id}/horario`, horarios);
  },

  obtenerBloqueos: async (id: string): Promise<BloqueoDto[]> => {
    const { data } = await api.get(`/empleados/${id}/bloqueo`);
    return data;
  },

  crearBloqueo: async (id: string, dto: Omit<BloqueoDto, "id">): Promise<BloqueoDto> => {
    const { data } = await api.post(`/empleados/${id}/bloqueo`, dto);
    return data;
  },

  eliminarBloqueo: async (empleadoId: string, bloqueoId: string): Promise<void> => {
    await api.delete(`/empleados/${empleadoId}/bloqueo/${bloqueoId}`);
  },

  subirFoto: async (id: string, archivo: File): Promise<EmpleadoDto> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post(`/empleados/${id}/foto`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
