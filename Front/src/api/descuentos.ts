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

export interface DatosCupon {
  codigo: string;
  descripcion?: string;
  tipo: string;
  valor: number;
  usoMaximo?: number;
  fechaExpiracion?: string;
}

export const descuentosApi = {
  /** B14: con `incluirInactivos` también llegan los desactivados, para reactivarlos. */
  getDescuentos: (incluirInactivos = false) =>
    api.get<Descuento[]>("/descuentos", { params: { incluirInactivos } }).then((r) => r.data),

  crear: (data: DatosCupon) => api.post<Descuento>("/descuentos", data).then((r) => r.data),

  /** B16: los usos ya hechos se conservan; el límite no puede quedar por debajo de ellos. */
  actualizar: (id: string, data: DatosCupon) =>
    api.put<Descuento>(`/descuentos/${id}`, data).then((r) => r.data),

  /** Baja reversible: deja de aceptarse al reservar. */
  desactivar: (id: string) => api.delete(`/descuentos/${id}`),

  reactivar: (id: string) => api.patch<Descuento>(`/descuentos/${id}/reactivar`).then((r) => r.data),
};

export const descuentosPublicoApi = {
  validar: (codigo: string, slug: string) =>
    api.get<DescuentoValidado>("/publico/descuentos/validar", {
      params: { codigo, slug },
    }).then((r) => r.data),
};
