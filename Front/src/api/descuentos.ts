import { api } from "./axios";

export interface Descuento {
  id: string;
  codigo: string;
  descripcion?: string;
  tipo: "Porcentaje" | "MontoFijo";
  valor: number;
  usoMaximo?: number;
  usoActual: number;
  fechaExpiracion?: string;
  activo: boolean;
  agotado: boolean;
  expirado: boolean;
}

export interface DescuentoValidado {
  id: string;
  codigo: string;
  descripcion?: string;
  tipo: "Porcentaje" | "MontoFijo";
  valor: number;
}

export const descuentosApi = {
  getDescuentos: () =>
    api.get<Descuento[]>("/descuentos").then((r) => r.data),

  crear: (data: {
    codigo: string;
    descripcion?: string;
    tipo: string;
    valor: number;
    usoMaximo?: number;
    fechaExpiracion?: string;
  }) => api.post<Descuento>("/descuentos", data).then((r) => r.data),

  eliminar: (id: string) => api.delete(`/descuentos/${id}`),
};

export const descuentosPublicoApi = {
  validar: (codigo: string, slug: string) =>
    api.get<DescuentoValidado>("/publico/descuentos/validar", {
      params: { codigo, slug },
    }).then((r) => r.data),
};
