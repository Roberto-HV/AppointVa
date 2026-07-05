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
  probarPushNotificacion: async (): Promise<{ mensaje: string }> => {
    const res = await api.post<{ mensaje: string }>("/me/push-test");
    return res.data;
  },
  obtenerPushStatus: async (): Promise<{
    suscriptoEnBd: boolean;
    endpoint: string | null;
    vapidPublicKey: boolean;
    vapidPrivateKey: boolean;
  }> => {
    const res = await api.get("/me/push-status");
    return res.data;
  },
};
