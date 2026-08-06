import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NegociosAdminPage from './NegociosAdminPage';
import * as adminModule from '../../api/admin';

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    setEmpleadosExtra: vi.fn(),
  },
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const mockNegocio = {
  id: 'neg-1',
  nombre: 'Peluquería Test',
  slug: 'peluqueria-test',
  activo: 1,
  maxCitasMes: 100,
  maxEmpleados: 3,
  citasMes: 10,
  empleadosActivos: 2,
  emailsMes: 5,
  planNombre: 'Pro',
  planId: 'plan-pro',
  moduloPagosHabilitado: true,
};

const mockSuscripcion = {
  negocioId: 'neg-1',
  negocioNombre: 'Peluquería Test',
  negocioSlug: 'peluqueria-test',
  fechaVencimiento: '2026-12-31T00:00:00Z',
  estado: 'Activa' as const,
  diasRestantes: 147,
  totalPagos: 3,
  ultimoPago: null,
  planNombre: 'Pro',
  precioBase: 449,
  maxEmpleadosBase: 3,
  empleadosExtra: 0,
  totalMensual: 449,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NegociosAdminPage />
    </QueryClientProvider>
  );
}

describe('ModalSuscripcion billing header', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.setEmpleadosExtra).mockResolvedValue(undefined);
  });

  it('shows plan name and base price in billing header', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument();
      expect(screen.getByText(/\$449/)).toBeInTheDocument();
    });
  });

  it('updates total mensual display when empleados extra changes', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    await waitFor(() => screen.getByRole('spinbutton'));

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2' } });

    // 449 + 2*49 = 547
    expect(screen.getByText(/\$547/)).toBeInTheDocument();
  });

  it('pre-fills monto with totalMensual when 1-month button clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    await waitFor(() => screen.getByText(/1 mes/i));

    fireEvent.click(screen.getByText(/1 mes/i));

    const montoInput = screen.getByDisplayValue('449');
    expect(montoInput).toBeInTheDocument();
  });
});
