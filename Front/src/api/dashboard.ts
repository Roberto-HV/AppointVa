import { api } from "./axios";
import type { PuntoDatos, ResumenDashboard } from "../types";

export const dashboardApi = {
  obtenerResumen: async (): Promise<ResumenDashboard> => {
    const { data } = await api.get("/dashboard/resumen");
    return data;
  },

  obtenerTendencia: async (dias = 14): Promise<PuntoDatos[]> => {
    const { data } = await api.get("/dashboard/tendencia", { params: { dias } });
    return data;
  },
};
