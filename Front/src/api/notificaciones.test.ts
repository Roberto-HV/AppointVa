import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as axiosModule from './axios';
import { notificacionesApi } from './notificaciones';

vi.mock('./axios', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mockNotifs = [
  {
    id: 'n1',
    tipo: 'NuevaCita' as const,
    titulo: 'Nueva cita de Ana',
    descripcion: 'Corte con María · lun 7 de ago, 10:00',
    fechaCreacion: '2026-08-07T10:00:00Z',
    leida: false,
    citaId: 'c1',
  },
];

describe('notificacionesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listar returns data from GET /notificaciones', async () => {
    vi.mocked(axiosModule.api.get).mockResolvedValue({ data: mockNotifs });
    const result = await notificacionesApi.listar();
    expect(axiosModule.api.get).toHaveBeenCalledWith('/notificaciones');
    expect(result).toEqual(mockNotifs);
  });

  it('marcarLeidas calls PUT /notificaciones/marcar-leidas', async () => {
    vi.mocked(axiosModule.api.put).mockResolvedValue({});
    await notificacionesApi.marcarLeidas();
    expect(axiosModule.api.put).toHaveBeenCalledWith('/notificaciones/marcar-leidas');
  });

  it('eliminar calls DELETE /notificaciones/{id}', async () => {
    vi.mocked(axiosModule.api.delete).mockResolvedValue({});
    await notificacionesApi.eliminar('n1');
    expect(axiosModule.api.delete).toHaveBeenCalledWith('/notificaciones/n1');
  });
});
