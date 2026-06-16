import { api } from "./axios";

export interface EntradaListaEspera {
  id: string;
  nombreCliente: string;
  telefonoCliente: string;
  emailCliente?: string;
  fechaPreferida?: string;
  estado: "Esperando" | "Notificado" | "Confirmado" | "Expirado";
  fechaCreacion: string;
  fechaNotificacion?: string;
  servicioNombre?: string;
  empleadoNombre?: string;
}

export const listaEsperaApi = {
  obtener: (estado?: string) =>
    api.get<EntradaListaEspera[]>("/lista-espera", { params: { estado } }).then((r) => r.data),

  cambiarEstado: (id: string, estado: string) =>
    api.patch(`/lista-espera/${id}/estado`, { estado }).then((r) => r.data),

  eliminar: (id: string) => api.delete(`/lista-espera/${id}`),
};

export const listaEsperaPublicoApi = {
  unirse: (data: {
    slug: string;
    nombreCliente: string;
    telefonoCliente: string;
    emailCliente?: string;
    servicioId?: string;
    empleadoId?: string;
    fechaPreferida?: string;
  }) => api.post("/publico/lista-espera", data).then((r) => r.data),
};
