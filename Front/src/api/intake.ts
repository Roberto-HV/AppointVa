import { api } from "./axios";

export interface CampoIntake {
  id: string;
  etiqueta: string;
  tipo: "Texto" | "MultilineTexto" | "Seleccion" | "Checkbox";
  opciones?: string; // JSON array for Seleccion
  requerido: boolean;
  orden: number;
  activo?: boolean;
  servicioId?: string;
  servicioNombre?: string;
}

export interface RespuestaIntakeInput {
  campoIntakeId: string;
  valor?: string;
}

export const intakeApi = {
  getCampos: (servicioId?: string) =>
    api.get<CampoIntake[]>("/intake/campos", { params: { servicioId } }).then((r) => r.data),

  crearCampo: (data: {
    etiqueta: string;
    tipo: string;
    opciones?: string;
    requerido: boolean;
    servicioId?: string;
  }) => api.post<CampoIntake>("/intake/campos", data).then((r) => r.data),

  actualizarCampo: (id: string, data: {
    etiqueta: string;
    tipo: string;
    opciones?: string;
    requerido: boolean;
    servicioId?: string;
  }) => api.put<CampoIntake>(`/intake/campos/${id}`, data).then((r) => r.data),

  eliminarCampo: (id: string) => api.delete(`/intake/campos/${id}`),

  reordenar: (items: { id: string; orden: number }[]) =>
    api.patch("/intake/campos/reordenar", items),

  getRespuestas: (citaId: string) =>
    api.get<{ etiqueta: string; tipo: string; valor?: string }[]>(
      `/intake/respuestas/${citaId}`
    ).then((r) => r.data),
};

export const intakePublicoApi = {
  getCampos: (slug: string, servicioId?: string) =>
    api.get<CampoIntake[]>(`/publico/intake/${slug}`, { params: { servicioId } }).then((r) => r.data),

  guardarRespuestas: (citaId: string, respuestas: RespuestaIntakeInput[]) =>
    api.post(`/publico/intake/${citaId}`, respuestas).then((r) => r.data),
};
