import { api } from "./axios";
import type { CierreCajaDto, GuardarCierreCajaDto } from "../types";

export const cierreCajaApi = {
  obtener: async (fecha: string): Promise<CierreCajaDto> => {
    const { data } = await api.get("/cierre-caja", { params: { fecha } });
    return data;
  },
  guardar: async (payload: GuardarCierreCajaDto): Promise<CierreCajaDto> => {
    const { data } = await api.post("/cierre-caja", payload);
    return data;
  },
};
