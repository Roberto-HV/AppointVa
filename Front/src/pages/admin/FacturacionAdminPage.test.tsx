import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import FacturacionAdminPage from './FacturacionAdminPage';
import * as adminModule from '../../api/admin';

// Facturación era la pestaña "Facturación" de Negocios; con su propia entrada
// del menú (lote 4) sus pruebas se movieron aquí sin cambiar lo que comprueban.

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    obtenerPlanes: vi.fn(),
    setEmpleadosExtra: vi.fn(),
  },
}));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({ toast: toastMock }),
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
  precioEmpleadoExtra: 50,
  sector: 'belleza',
  esTester: false,
  suscripcionVigente: true,
  accesoPermanente: false,
  ingresoMensual: 449,
};

const mockSuscripcionVencida = {
  ...mockSuscripcion,
  negocioId: 'neg-2',
  negocioNombre: 'Barbería Vencida',
  estado: 'Vencida' as const,
  diasRestantes: 0,
  totalMensual: 249,
  precioBase: 249,
  planNombre: 'Basico',
  suscripcionVigente: false,
  ingresoMensual: 0,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FacturacionAdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function simularTelefono() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width: 639.98px'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
  vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion, mockSuscripcionVencida]);
  vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
});

describe('FacturacionAdminPage — tabla', () => {
  it('tiene su propio título y lista los negocios con suscripción', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Facturación' })).toBeInTheDocument();
    expect(await screen.findByText('Peluquería Test')).toBeInTheDocument();
  });

  it('pone las vencidas antes que las activas', async () => {
    renderPage();
    await screen.findByText('Barbería Vencida');

    const names = screen.getAllByRole('row').map(r => r.textContent ?? '');
    const vencidaIdx = names.findIndex(t => t.includes('Barbería Vencida'));
    const activaIdx = names.findIndex(t => t.includes('Peluquería Test'));
    expect(vencidaIdx).toBeLessThan(activaIdx);
  });

  it('el pie y el KPI suman lo mismo: el ingreso de las filas, no el precio de lista (G3)', async () => {
    renderPage();
    await screen.findByText('Barbería Vencida');

    // Cada fila muestra el precio de su plan aunque no se pague...
    const vencida = screen.getByText('Barbería Vencida').closest('tr')!;
    expect(within(vencida).getByText('$249')).toBeInTheDocument();
    // ...pero la vencida no aporta al ingreso: "—" con el motivo.
    expect(within(vencida).getByText(/Suscripción vencida/)).toBeInTheDocument();
    // M6: el plan "Basico" de la BD se muestra con su acento.
    expect(within(vencida).getByText('Básico')).toBeInTheDocument();

    // Antes el pie decía $698 (449 + 249 de la vencida).
    expect(screen.getByTestId('total-ingreso-mensual')).toHaveTextContent('$449');
    expect(screen.getByText(/1 de 2 con suscripción vigente/)).toBeInTheDocument();

    const kpi = screen.getByText('Ingreso mensual', { selector: 'p' }).closest('div')!;
    expect(within(kpi).getByText('$449/mes')).toBeInTheDocument();
  });

  it('un plan asignado sin pago no se lee como ingreso: "Sin pago registrado" y $0 en el pie', async () => {
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      { ...mockSuscripcion, estado: 'SinSuscripcion', diasRestantes: null, fechaVencimiento: null,
        suscripcionVigente: false, ingresoMensual: 0 },
    ]);
    renderPage();

    const fila = (await screen.findByText('Peluquería Test')).closest('tr')!;
    expect(within(fila).getByText('$449')).toBeInTheDocument();
    expect(within(fila).getByText('Sin pago registrado')).toBeInTheDocument();
    expect(screen.getByTestId('total-ingreso-mensual')).toHaveTextContent('$0');
  });

  it('no dice "Sin facturación todavía" mientras carga', async () => {
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockReset().mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole('status', { name: 'Cargando facturación' })).toBeInTheDocument();
    expect(screen.queryByText('Sin facturación todavía')).not.toBeInTheDocument();
  });

  it('el nombre del negocio lleva a su ficha, directo a "Suscripción y pagos" (lote 4)', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Peluquería Test' }))
      .toHaveAttribute('href', '/admin/negocios/neg-1?seccion=suscripcion');
  });

  it('"Ver suscripción" sigue abriendo el modal del negocio', async () => {
    const user = userEvent.setup();
    renderPage();
    const fila = (await screen.findByText('Peluquería Test')).closest('tr')!;
    await user.click(within(fila).getByRole('button', { name: 'Ver suscripción' }));
    expect(await screen.findByRole('dialog', { name: 'Suscripción — Peluquería Test' })).toBeInTheDocument();
  });

  it('los empleados extra de una fila se guardan con "Guardar" y el nuevo total', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.setEmpleadosExtra).mockResolvedValue(undefined);
    renderPage();
    const campo = await screen.findByRole('spinbutton', { name: 'Empleados extra de Peluquería Test' });
    await user.clear(campo);
    await user.type(campo, '2');
    expect(adminModule.adminApi.setEmpleadosExtra).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Guardar 2 empleados extra de Peluquería Test: total \$549/ }));
    expect(adminModule.adminApi.setEmpleadosExtra).toHaveBeenCalledWith('neg-1', 2);
  });
});

describe('FacturacionAdminPage — tarjetas en el teléfono (I6)', () => {
  beforeEach(() => {
    simularTelefono();
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      mockSuscripcion,
      { ...mockSuscripcionVencida, planNombre: 'Pro', totalMensual: 449, precioBase: 449, fechaVencimiento: '2026-09-30T00:00:00' },
    ]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('son tarjetas con ingreso, estado y vencimiento a la vista, sin tabla', async () => {
    renderPage();

    const lista = await screen.findByRole('list', { name: 'Suscripciones' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const [vencida, activa] = within(lista).getAllByRole('listitem');
    // Vencidas primero, como en la tabla.
    expect(vencida).toHaveTextContent('Barbería Vencida');
    expect(within(vencida).getByText('Vencida')).toBeInTheDocument();
    expect(within(vencida).getByText('Sin ingreso')).toBeInTheDocument();
    expect(within(vencida).getByText(/Vence: 30 sep 2026/)).toBeInTheDocument();
    expect(activa).toHaveTextContent('$449/mes');
    expect(within(activa).getByText('Activa')).toBeInTheDocument();
    // El pie suma lo mismo que la tabla y el KPI.
    expect(screen.getByTestId('total-ingreso-mensual')).toHaveTextContent('$449');
  });

  it('"Ver suscripción" abre el modal del negocio', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Ver suscripción de Peluquería Test' }));
    expect(await screen.findByRole('dialog', { name: 'Suscripción — Peluquería Test' })).toBeInTheDocument();
  });
});
