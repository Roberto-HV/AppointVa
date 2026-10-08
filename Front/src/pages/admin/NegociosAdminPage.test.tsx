import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NegociosAdminPage from './NegociosAdminPage';
import * as adminModule from '../../api/admin';

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    obtenerPlanes: vi.fn(),
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

// ── Badge de vigencia ───────────────────────────────────────────────────────

describe('BadgeSuscripcion — vigencia legible', () => {
  function conDiasRestantes(dias: number, fechaVencimiento: string) {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      { ...mockSuscripcion, diasRestantes: dias, fechaVencimiento },
    ]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  }

  it('resume un acceso de por vida en vez de imprimir los días', async () => {
    // "De por vida" se registra como 1200 meses, así que el backend devuelve
    // ~37160 días: un número correcto pero ilegible.
    conDiasRestantes(37160, '2126-09-30T00:00:00');
    renderPage();

    expect(await screen.findByText('De por vida')).toBeInTheDocument();
    expect(screen.queryByText(/37160/)).not.toBeInTheDocument();
  });

  it('usa meses cuando la vigencia pasa de dos meses', async () => {
    conDiasRestantes(147, '2026-12-31T00:00:00');
    renderPage();

    expect(await screen.findByText(/Activa · 5 meses/)).toBeInTheDocument();
  });

  it('usa años cuando la vigencia pasa de un año', async () => {
    conDiasRestantes(800, '2028-12-31T00:00:00');
    renderPage();

    expect(await screen.findByText(/Activa · 2 años/)).toBeInTheDocument();
  });

  it('mantiene los días cuando la cifra todavía se lee', async () => {
    conDiasRestantes(21, '2026-10-29T00:00:00');
    renderPage();

    expect(await screen.findByText(/Activa · 21 d/)).toBeInTheDocument();
  });
});

// ── Filtros y paginación ────────────────────────────────────────────────────

function negocio(i: number, extra: Partial<typeof mockNegocio> = {}) {
  return {
    ...mockNegocio,
    id: `neg-${i}`,
    nombre: `Negocio ${String(i).padStart(2, '0')}`,
    slug: `negocio-${i}`,
    ...extra,
  };
}

describe('NegociosAdminPage — filtros y paginación', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  });

  it('pagina la rejilla de tarjetas a 15 por página', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue(
      Array.from({ length: 18 }, (_, i) => negocio(i + 1))
    );
    renderPage();

    await screen.findByText('Negocio 01');
    expect(screen.queryByText('Negocio 16')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));

    expect(await screen.findByText('Negocio 16')).toBeInTheDocument();
    expect(screen.queryByText('Negocio 01')).not.toBeInTheDocument();
  });

  it('el contador de la paginación describe el total, no la página', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue(
      Array.from({ length: 18 }, (_, i) => negocio(i + 1))
    );
    renderPage();

    const paginacion = await screen.findByRole('navigation', { name: 'Paginación' });
    expect(paginacion).toHaveTextContent('18 negocios · página 1 de 2');
  });

  it('la búsqueda se aplica al confirmar, no al teclear', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Barbería Luis' }),
      negocio(2, { nombre: 'Salón Aramis' }),
    ]);
    renderPage();

    await screen.findByText('Barbería Luis');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar negocio' }), 'Aramis');
    expect(screen.getByText('Barbería Luis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(screen.queryByText('Barbería Luis')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Salón Aramis')).toBeInTheDocument();
  });

  it('filtra por estado activo/inactivo', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Activo SA', activo: 1 }),
      negocio(2, { nombre: 'Inactivo SA', activo: 0 }),
    ]);
    renderPage();

    await screen.findByText('Activo SA');

    await user.click(screen.getByRole('button', { name: 'Estado' }));
    await user.click(screen.getByRole('option', { name: 'Inactivos' }));

    await waitFor(() => {
      expect(screen.queryByText('Activo SA')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Inactivo SA')).toBeInTheDocument();
  });

  it('ofrece restablecer cuando ningún negocio coincide', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1)]);
    renderPage();

    await screen.findByText('Negocio 01');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar negocio' }), 'zzz');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    const reset = await screen.findByRole('button', { name: 'Ver todos los negocios' });
    await user.click(reset);

    expect(await screen.findByText('Negocio 01')).toBeInTheDocument();
  });
});

// ── KPI "Con plan" ──────────────────────────────────────────────────────────

describe('NegociosAdminPage — KPI "Con plan"', () => {
  it('no cuenta los negocios de prueba, igual que "Ingresos est."', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      { ...mockNegocio, id: 'neg-1', esTester: false },
      { ...mockNegocio, id: 'neg-tester', nombre: 'Tester SA', esTester: true },
    ]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      { ...mockSuscripcion, negocioId: 'neg-1' },
      { ...mockSuscripcion, negocioId: 'neg-tester', negocioNombre: 'Tester SA' },
    ]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);

    renderPage();

    const tarjeta = (await screen.findByText('Con plan')).closest('div')!;
    // Dos suscripciones con plan, pero una es de un negocio tester.
    expect(within(tarjeta).getByText('1')).toBeInTheDocument();
  });
});
