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
  sector: 'belleza',
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
      const billingSummary = screen.getByTestId('billing-summary');
      expect(billingSummary.textContent).toContain('Pro');
      expect(billingSummary.textContent).toMatch(/\$449/);
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

    // 449 + 2*50 = 549
    const billingSummary = screen.getByTestId('billing-summary');
    expect(billingSummary.textContent).toMatch(/\$549/);
  });

  it('pre-fills monto with totalMensual when 1-month button clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));

    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);

    // Navigate to Pagos tab where the month buttons live
    await waitFor(() => screen.getByText('Pagos'));
    fireEvent.click(screen.getByText('Pagos'));

    await waitFor(() => screen.getByText(/1 mes/i));

    fireEvent.click(screen.getByText(/1 mes/i));

    const montoInput = screen.getByDisplayValue('449');
    expect(montoInput).toBeInTheDocument();
  });
});

describe('Facturación tab', () => {
  const mockSuscripcionVencida = {
    ...mockSuscripcion,
    negocioId: 'neg-2',
    negocioNombre: 'Barbería Vencida',
    estado: 'Vencida' as const,
    diasRestantes: 0,
    totalMensual: 249,
    precioBase: 249,
    planNombre: 'Básico',
  };

  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      mockSuscripcion,
      mockSuscripcionVencida,
    ]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  });

  it('renders Facturación tab when clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Negocios'));

    fireEvent.click(screen.getByText('Facturación'));

    await waitFor(() => {
      expect(screen.getByText('Peluquería Test')).toBeInTheDocument();
    });
  });

  it('shows Vencida rows before Activa in the billing table', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Negocios'));

    fireEvent.click(screen.getByText('Facturación'));

    await waitFor(() => screen.getByText('Barbería Vencida'));

    const rows = screen.getAllByRole('row');
    const names = rows.map(r => r.textContent ?? '');
    const vencidaIdx = names.findIndex(t => t.includes('Barbería Vencida'));
    const activaIdx = names.findIndex(t => t.includes('Peluquería Test'));
    expect(vencidaIdx).toBeLessThan(activaIdx);
  });

  it('shows estimated monthly total in the summary footer', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Facturación'));

    await waitFor(() => {
      // 449 + 249 = 698 (may appear in metrics strip and table footer)
      expect(screen.getAllByText(/\$698/).length).toBeGreaterThan(0);
    });
  });
});
