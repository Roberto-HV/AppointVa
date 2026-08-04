import { api } from "./axios";
import type { CitaDto } from "../types";

export interface RegistrarPagoPayload {
  pagada: boolean;
  metodoPago?: string;
  montoCobrado?: number;
  montoRecibido?: number;
  cambio?: number;
  propina?: number;
  metodoPago2?: string;
  montoPago2?: number;
}

export const pagosApi = {
  registrar: async (citaId: string, payload: RegistrarPagoPayload): Promise<CitaDto> => {
    const { data } = await api.patch(`/citas/${citaId}/pago`, payload);
    return data;
  },

  enviarTicketEmail: async (citaId: string): Promise<void> => {
    await api.post(`/citas/${citaId}/ticket-email`);
  },
};
