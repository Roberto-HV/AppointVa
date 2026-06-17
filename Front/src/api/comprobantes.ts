import { api } from "./axios";

export const comprobantesApi = {
  subirComprobante: async (codigo: string, archivo: File): Promise<{ comprobanteUrl: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post(`/publico/citas/${codigo}/comprobante`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
