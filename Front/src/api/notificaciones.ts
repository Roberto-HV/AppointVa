import { api } from './axios';

export interface NotificacionDto {
  id: string;
  tipo: 'NuevaCita' | 'Cancelacion';
  titulo: string;
  descripcion: string;
  fechaCreacion: string;
  leida: boolean;
  citaId?: string;
}

export const notificacionesApi = {
  listar: (): Promise<NotificacionDto[]> =>
    api.get('/notificaciones').then(r => r.data),

  marcarLeidas: (): Promise<void> =>
    api.put('/notificaciones/marcar-leidas').then(() => undefined),

  eliminar: (id: string): Promise<void> =>
    api.delete(`/notificaciones/${id}`).then(() => undefined),
};
