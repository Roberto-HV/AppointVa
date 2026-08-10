import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NotificacionesBell } from './NotificacionesBell';
import * as notifModule from '../../api/notificaciones';

vi.mock('../../api/notificaciones', () => ({
  notificacionesApi: {
    listar: vi.fn(),
    marcarLeidas: vi.fn(),
    eliminar: vi.fn(),
  },
}));

function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NotificacionesBell />
    </QueryClientProvider>
  );
}

const mockNotifs = [
  {
    id: 'n1',
    tipo: 'NuevaCita' as const,
    titulo: 'Nueva cita de Ana',
    descripcion: 'Corte con María · lun 7 de ago, 10:00',
    fechaCreacion: new Date().toISOString(),
    leida: false,
  },
];

describe('NotificacionesBell', () => {
  beforeEach(() => {
    vi.mocked(notifModule.notificacionesApi.listar).mockResolvedValue(mockNotifs);
    vi.mocked(notifModule.notificacionesApi.marcarLeidas).mockResolvedValue(undefined);
    vi.mocked(notifModule.notificacionesApi.eliminar).mockResolvedValue(undefined);
  });

  it('shows unread badge count when there are unread notifications', async () => {
    renderBell();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('opens dropdown and shows notification title when bell is clicked', async () => {
    renderBell();
    await waitFor(() => screen.getByLabelText('Notificaciones'));
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    await waitFor(() => {
      expect(screen.getByText('Nueva cita de Ana')).toBeInTheDocument();
    });
  });

  it('calls marcarLeidas when dropdown opens with unread notifications', async () => {
    renderBell();
    await waitFor(() => screen.getByLabelText('Notificaciones'));
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    await waitFor(() => {
      expect(notifModule.notificacionesApi.marcarLeidas).toHaveBeenCalled();
    });
  });

  it('shows empty state message when no notifications', async () => {
    vi.mocked(notifModule.notificacionesApi.listar).mockResolvedValue([]);
    renderBell();
    await waitFor(() => screen.getByLabelText('Notificaciones'));
    fireEvent.click(screen.getByLabelText('Notificaciones'));
    await waitFor(() => {
      expect(screen.getByText('Sin notificaciones')).toBeInTheDocument();
    });
  });
});
