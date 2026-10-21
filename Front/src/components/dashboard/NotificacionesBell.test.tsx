import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <NotificacionesBell />
      </QueryClientProvider>
    </MemoryRouter>
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
    await waitFor(() => screen.getByRole('button', { name: /^Notificaciones/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }));
    await waitFor(() => {
      expect(screen.getByText('Nueva cita de Ana')).toBeInTheDocument();
    });
  });

  it('calls marcarLeidas when dropdown opens with unread notifications', async () => {
    renderBell();
    // Wait for the query to resolve so noLeidas > 0 before clicking
    await waitFor(() => screen.getByText('1'));
    fireEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }));
    await waitFor(() => {
      expect(notifModule.notificacionesApi.marcarLeidas).toHaveBeenCalled();
    });
  });

  it('shows empty state message when no notifications', async () => {
    vi.mocked(notifModule.notificacionesApi.listar).mockResolvedValue([]);
    renderBell();
    await waitFor(() => screen.getByRole('button', { name: /^Notificaciones/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Notificaciones/ }));
    await waitFor(() => {
      expect(screen.getByText('Sin notificaciones')).toBeInTheDocument();
    });
  });

  it('anuncia las no leídas en el nombre de la campana', async () => {
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' })).toBeInTheDocument();
  });

  it('cada notificación con cita es un botón que abre el detalle, y Escape cierra el panel', async () => {
    const conCita = [{ ...mockNotifs[0], citaId: 'cita-9' }];
    vi.mocked(notifModule.notificacionesApi.listar).mockResolvedValue(conCita);
    renderBell();
    const campana = await screen.findByRole('button', { name: /^Notificaciones/ });
    fireEvent.click(campana);
    expect(await screen.findByRole('button', { name: /^Nueva cita de Ana/ })).toBeInTheDocument();
    expect(campana).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Nueva cita de Ana')).toBeNull());
    expect(campana).toHaveFocus();
  });
});
