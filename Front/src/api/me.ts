import { api } from "./axios";

interface PushSuscripcionDto {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const meApi = {
  guardarPushSuscripcion: async (dto: PushSuscripcionDto) => {
    await api.post("/me/push-subscription", dto);
  },
  eliminarPushSuscripcion: async () => {
    await api.delete("/me/push-subscription");
  },
};
