import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NegociosAdminPage from './NegociosAdminPage';
import * as adminModule from '../../api/admin';

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    obtenerPlanes: vi.fn(),
    setEmpleadosExtra: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
    setSector: vi.fn(),
    setPlan: vi.fn(),
    toggleModuloPagos: vi.fn(),
    setTester: vi.fn(),
    registrarPago: vi.fn(),
    confirmarEmail: vi.fn(),
    eliminarPago: vi.fn(),
    crearNegocio: vi.fn(),
    obtenerImpactoEliminacion: vi.fn(),
  },
}));

const authMock = vi.hoisted(() => ({ reautenticar: vi.fn(), obtenerEstado2FA: vi.fn() }));
vi.mock('../../api/auth', () => ({
  verificarSlug: vi.fn().mockResolvedValue({ disponible: true }),
  authApi: authMock,
}));
import { verificarSlug } from '../../api/auth';

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({ success: vi.fn(), error: vi.fn(), toast: toastMock }),
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <NegociosAdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Lote 4: en escritorio la lista es una tabla por defecto. Estas pruebas cubren
// las tarjetas y sus flujos (lotes 1–3), así que eligen esa vista como lo haría
// el admin con el selector; la tabla tiene sus propias pruebas en
// `NegociosAdminPage.tabla.test.tsx`.
beforeEach(() => localStorage.setItem('admin-negocios-vista', 'tarjetas'));
afterEach(() => localStorage.clear());

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

// La tabla de Facturación y su pie se movieron con la página a
// `FacturacionAdminPage.test.tsx` (lote 4); aquí queda lo que ve la tarjeta.
describe('Plan asignado sin pago en la tarjeta y los KPIs (G3)', () => {
  it('un plan asignado sin pago no se lee como ingreso: "Sin pago registrado" y $0 en el KPI', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      { ...mockSuscripcion, estado: 'SinSuscripcion', diasRestantes: null, fechaVencimiento: null,
        suscripcionVigente: false, ingresoMensual: 0 },
    ]);
    renderPage();

    // Tarjeta: "Pro" junto a "Sin pago registrado", no "Sin suscripción".
    const tarjeta = await screen.findByRole('article', { name: 'Peluquería Test' });
    expect(await within(tarjeta).findByText('Sin pago registrado')).toBeInTheDocument();
    const kpiVigente = screen.getByText('Con suscripción vigente').closest('div')!;
    expect(within(kpiVigente).getByText('0')).toBeInTheDocument();
    expect(within(kpiVigente).getByText('de 1 con plan asignado')).toBeInTheDocument();
    const kpi = screen.getByText('Ingreso mensual', { selector: 'p' }).closest('div')!;
    expect(within(kpi).getByText('$0/mes')).toBeInTheDocument();
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

function negocio(i: number, extra: Partial<adminModule.NegocioMetricasDto> = {}) {
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
    // Filtra en vivo, sin botón "Buscar".

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

    const reset = await screen.findByRole('button', { name: 'Ver todos los negocios' });
    await user.click(reset);

    expect(await screen.findByText('Negocio 01')).toBeInTheDocument();
  });
});

// ── Activar / desactivar (AP-06) ────────────────────────────────────────────

describe('NegociosAdminPage — desactivar negocio', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.desactivar).mockReset();
    vi.mocked(adminModule.adminApi.activar).mockReset();
    toastMock.mockReset();
  });

  function tarjetaDe(nombre: string) {
    // La tarjeta es el contenedor que tiene el nombre y el botón de estado.
    let el: HTMLElement | null = screen.getByText(nombre);
    while (el && !within(el).queryByRole('button', { name: /Desactivar|Activar|Guardando/ })) {
      el = el.parentElement;
    }
    return el!;
  }

  it('pide confirmación con el nombre y la consecuencia antes de desactivar', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1, { nombre: 'Barbería Luis', slug: 'barberia-luis' })]);
    vi.mocked(adminModule.adminApi.desactivar).mockResolvedValue(undefined as never);
    renderPage();

    await screen.findByText('Barbería Luis');
    await user.click(within(tarjetaDe('Barbería Luis')).getByRole('button', { name: /Desactivar/ }));

    // Nada se envía hasta confirmar.
    expect(adminModule.adminApi.desactivar).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('¿Desactivar Barbería Luis?');
    expect(dialogo).toHaveTextContent('/b/barberia-luis');
    expect(dialogo).toHaveTextContent('dejará de aceptar reservas');

    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar negocio' }));
    await waitFor(() => expect(adminModule.adminApi.desactivar).toHaveBeenCalledWith('neg-1'));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Negocio desactivado'));
  });

  it('volver cierra la confirmación sin desactivar', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1, { nombre: 'Barbería Luis' })]);
    renderPage();

    await screen.findByText('Barbería Luis');
    await user.click(within(tarjetaDe('Barbería Luis')).getByRole('button', { name: /Desactivar/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(adminModule.adminApi.desactivar).not.toHaveBeenCalled();
  });

  it('mientras se activa un negocio solo su tarjeta queda en espera', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Inactivo Uno', activo: 0 }),
      negocio(2, { nombre: 'Inactivo Dos', activo: 0 }),
    ]);
    // La petición no termina durante la prueba.
    vi.mocked(adminModule.adminApi.activar).mockReturnValue(new Promise(() => {}) as never);
    renderPage();

    await screen.findByText('Inactivo Uno');
    await user.click(within(tarjetaDe('Inactivo Uno')).getByRole('button', { name: /^Activar/ }));

    expect(await within(tarjetaDe('Inactivo Uno')).findByRole('button', { name: /Guardando/ })).toBeDisabled();
    const otra = within(tarjetaDe('Inactivo Dos')).getByRole('button', { name: /^Activar/ });
    expect(otra).toBeEnabled();
  });

  it('con dos cambios en curso, terminar uno no libera la otra tarjeta ni permite duplicados', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Inactivo Uno', activo: 0 }),
      negocio(2, { nombre: 'Inactivo Dos', activo: 0 }),
    ]);
    const resolvers: Record<string, () => void> = {};
    vi.mocked(adminModule.adminApi.activar).mockImplementation(
      (id: string) => new Promise<void>((r) => { resolvers[id] = r; }) as never
    );
    renderPage();

    await screen.findByText('Inactivo Uno');
    await user.click(within(tarjetaDe('Inactivo Uno')).getByRole('button', { name: /^Activar/ }));
    await user.click(within(tarjetaDe('Inactivo Dos')).getByRole('button', { name: /^Activar/ }));

    expect(await within(tarjetaDe('Inactivo Uno')).findByRole('button', { name: /Guardando/ })).toBeDisabled();
    expect(await within(tarjetaDe('Inactivo Dos')).findByRole('button', { name: /Guardando/ })).toBeDisabled();

    // Termina el segundo: el primero sigue en espera.
    resolvers['neg-2']();
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Negocio activado'));
    expect(within(tarjetaDe('Inactivo Uno')).getByRole('button', { name: /Guardando/ })).toBeDisabled();
    expect(adminModule.adminApi.activar).toHaveBeenCalledTimes(2);
  });
});

// ── Feedback de facturación (AP-23) ─────────────────────────────────────────

describe('ModalSuscripcion — cambios con confirmación y aviso', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.setEmpleadosExtra).mockReset().mockResolvedValue(undefined);
    vi.mocked(adminModule.adminApi.setSector).mockReset().mockResolvedValue(undefined as never);
    toastMock.mockReset();
  });

  async function abrirSuscripcion() {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));
    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);
    return screen.findByTestId('billing-summary');
  }

  it('cambiar el sector pide confirmación y avisa al terminar', async () => {
    const user = userEvent.setup();
    await abrirSuscripcion();
    await user.click(screen.getByRole('button', { name: 'Salud' }));
    expect(adminModule.adminApi.setSector).not.toHaveBeenCalled();
    // Lote 3: la misma `ConfirmarAccion` que el plan, no un aviso en línea.
    const dialogo = await screen.findByRole('dialog', { name: '¿Cambiar Peluquería Test a Salud?' });
    expect(dialogo).toHaveTextContent('Cambia el vocabulario');

    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar sector' }));
    await waitFor(() => expect(adminModule.adminApi.setSector).toHaveBeenCalledWith('neg-1', 'salud'));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Sector actualizado: Salud'));
  });

  it('los empleados extra no se guardan al salir del campo: "Guardar" muestra el nuevo total (I2)', async () => {
    const user = userEvent.setup();
    await abrirSuscripcion();
    const input = screen.getByRole('spinbutton');
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    expect(adminModule.adminApi.setEmpleadosExtra).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Guardar · $549/mes' }));
    await waitFor(() => expect(adminModule.adminApi.setEmpleadosExtra).toHaveBeenCalledWith('neg-1', 2));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Empleados extra actualizados: 2 · total $549/mes'));
  });

  it('"Descartar" vuelve al valor guardado sin llamar al servidor', async () => {
    const user = userEvent.setup();
    await abrirSuscripcion();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '4' } });
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(input).toHaveValue(0);
    expect(screen.queryByRole('button', { name: /Guardar/ })).not.toBeInTheDocument();
    expect(adminModule.adminApi.setEmpleadosExtra).not.toHaveBeenCalled();
  });

  it('un error al guardar empleados extra se muestra', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.setEmpleadosExtra).mockRejectedValue(new Error('red'));
    await abrirSuscripcion();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '3' } });
    await user.click(screen.getByRole('button', { name: 'Guardar · $599/mes' }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('No se pudieron actualizar los empleados extra.', 'error')
    );
  });

  it('el monto del pago empieza en el total mensual (M4)', async () => {
    const user = userEvent.setup();
    await abrirSuscripcion();
    await user.click(screen.getByRole('button', { name: 'Pagos' }));
    expect(screen.getByDisplayValue('449')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar pago/ })).toBeEnabled();
  });

  it('el monto sugerido sigue a los meses y a los empleados extra', async () => {
    const user = userEvent.setup();
    await abrirSuscripcion();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: 'Pagos' }));
    expect(screen.getByLabelText('Monto (MXN)')).toHaveValue('549');
    await user.click(screen.getByRole('button', { name: '3 meses' }));
    expect(screen.getByLabelText('Monto (MXN)')).toHaveValue('1647');
  });

  it('un monto tecleado no se pisa al cambiar los meses; tras registrar vuelve al sugerido', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.registrarPago).mockReset().mockResolvedValue({} as never);
    await abrirSuscripcion();
    await user.click(screen.getByRole('button', { name: 'Pagos' }));
    const monto = screen.getByLabelText('Monto (MXN)');

    await user.clear(monto);
    await user.type(monto, '1000');
    await user.click(screen.getByRole('button', { name: '3 meses' }));
    expect(monto).toHaveValue('1000');

    await user.click(screen.getByRole('button', { name: /Registrar pago/ }));
    await waitFor(() =>
      expect(adminModule.adminApi.registrarPago).toHaveBeenCalledWith('neg-1', { mesesPagados: 3, monto: 1000, notas: undefined })
    );
    // "3 meses" sigue marcado: el monto vuelve a 3 × 449, no a vacío.
    await waitFor(() => expect(monto).toHaveValue('1347'));
    expect(screen.getByRole('button', { name: /Registrar pago/ })).toBeEnabled();
  });

  // Lote 5 (G1): un acceso de por vida pide "Confirma que eres tú"; el mensual no.
  it('el acceso de por vida pide la identidad del admin antes de registrarse', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.registrarPago).mockReset().mockResolvedValue({} as never);
    authMock.obtenerEstado2FA.mockResolvedValue({ habilitado: true, tieneConfiguracion: true, codigosRecuperacionRestantes: 10 });
    authMock.reautenticar.mockResolvedValue({ token: 'prueba-vida', expiracion: new Date(Date.now() + 5 * 60_000).toISOString() });
    await abrirSuscripcion();
    await user.click(screen.getByRole('button', { name: 'Pagos' }));
    await user.click(screen.getByRole('button', { name: 'De por vida' }));
    await user.type(screen.getByLabelText('Monto (MXN)'), '9999');
    await user.click(screen.getByRole('button', { name: 'Registrar acceso de por vida' }));

    expect(await screen.findByText('Confirma que eres tú')).toBeInTheDocument();
    expect(adminModule.adminApi.registrarPago).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Tu contraseña'), 'Admin-Clave-1');
    await user.type(screen.getByLabelText('Código de verificación'), '654321');
    await user.click(screen.getByRole('button', { name: 'Confirmar y continuar' }));

    await waitFor(() => expect(adminModule.adminApi.registrarPago).toHaveBeenCalledWith(
      'neg-1', { mesesPagados: 1200, monto: 9999, notas: undefined }, 'prueba-vida'));
  });
});

// ── Cambio de plan con confirmación (I2) ────────────────────────────────────

describe('ModalSuscripcion — cambio de plan', () => {
  const planes = [
    { id: 'plan-basico', nombre: 'Basico', precioMensual: 249, maxEmpleados: 2, maxCitasMes: 200, habilitaModuloPagos: false },
    { id: 'plan-pro', nombre: 'Pro', precioMensual: 449, maxEmpleados: 3, maxCitasMes: 100, habilitaModuloPagos: true },
    { id: 'plan-premium', nombre: 'Premium', precioMensual: 649, maxEmpleados: 8, maxCitasMes: 1000, habilitaModuloPagos: false },
  ];

  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([{ ...mockSuscripcion, empleadosExtra: 1 }]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue(planes);
    vi.mocked(adminModule.adminApi.setPlan).mockReset().mockResolvedValue(undefined as never);
    toastMock.mockReset();
  });

  async function abrirSuscripcion() {
    renderPage();
    await waitFor(() => screen.getByText('Peluquería Test'));
    const btn = screen.getAllByRole('button').find(b => /suscripci/i.test(b.textContent ?? ''));
    fireEvent.click(btn!);
    await screen.findByTestId('billing-summary');
    return screen.findByRole('button', { name: 'Premium' });
  }

  it('un clic en otro plan no lo cambia: confirma con el antes y el después', async () => {
    const user = userEvent.setup();
    await user.click(await abrirSuscripcion());
    expect(adminModule.adminApi.setPlan).not.toHaveBeenCalled();

    const dialogo = await screen.findByRole('dialog', { name: /plan Premium/ });
    expect(dialogo).toHaveTextContent('Pro → Premium');
    expect(dialogo).toHaveTextContent('$449/mes → $649/mes');
    // Con 1 empleado extra: 449 + 50 → 649 + 50.
    expect(dialogo).toHaveTextContent('$499/mes → $699/mes');
    expect(dialogo).toHaveTextContent('3 → 8');
    // Premium llega con habilitaModuloPagos=false: el backend apaga el módulo de pagos.
    expect(dialogo).toHaveTextContent('El módulo de pagos quedará deshabilitado');

    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }));
    await waitFor(() => expect(adminModule.adminApi.setPlan).toHaveBeenCalledWith('neg-1', 'plan-premium'));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Plan actualizado: Premium'));
  });

  it('el aviso del módulo sale del dato del backend, no del nombre del plan', async () => {
    const user = userEvent.setup();
    // Un plan sin "Pro" en el nombre pero que el backend marca como habilitante.
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([
      planes[1],
      { ...planes[2], habilitaModuloPagos: true },
    ]);
    await user.click(await abrirSuscripcion());
    const dialogo = await screen.findByRole('dialog', { name: /plan Premium/ });
    expect(dialogo).not.toHaveTextContent('El módulo de pagos quedará');
  });

  it('tras cambiar de plan, el monto sugerido del pago usa el nuevo total', async () => {
    const user = userEvent.setup();
    await user.click(await abrirSuscripcion());
    const dialogo = await screen.findByRole('dialog', { name: /plan Premium/ });
    // Tras el cambio, la recarga trae el precio del nuevo plan.
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      { ...mockSuscripcion, empleadosExtra: 1, planNombre: 'Premium', precioBase: 649, totalMensual: 699 },
    ]);
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Plan actualizado: Premium'));

    await user.click(screen.getByRole('button', { name: 'Pagos' }));
    // 649 + 1 × 50; antes se quedaba en el 499 calculado al abrir el modal.
    await waitFor(() => expect(screen.getByLabelText('Monto (MXN)')).toHaveValue('699'));
  });

  it('"Volver" cierra la confirmación sin cambiar el plan', async () => {
    const user = userEvent.setup();
    await user.click(await abrirSuscripcion());
    const dialogo = await screen.findByRole('dialog', { name: /plan Premium/ });
    await user.click(within(dialogo).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /plan Premium/ })).not.toBeInTheDocument());
    expect(adminModule.adminApi.setPlan).not.toHaveBeenCalled();
  });

  it('muestra "Básico" con acento aunque la BD diga "Basico" (M6)', async () => {
    await abrirSuscripcion();
    expect(screen.getByRole('button', { name: 'Básico' })).toBeInTheDocument();
  });
});

// ── Interruptores con "Deshacer" y Confirmar correo (I2) ───────────────────

describe('NegociosAdminPage — interruptores y correo', () => {
  type OpcionesToast = { accion?: { etiqueta: string; onClick: () => void } };

  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.toggleModuloPagos).mockReset().mockResolvedValue(undefined);
    // El backend fija el valor pedido y lo devuelve.
    vi.mocked(adminModule.adminApi.setTester).mockReset()
      .mockImplementation(async (_id: string, esTester: boolean) => ({ esTester }));
    vi.mocked(adminModule.adminApi.confirmarEmail).mockReset().mockResolvedValue(undefined as never);
    toastMock.mockReset();
  });

  function accionDelUltimoToast(): { etiqueta: string; onClick: () => void } | undefined {
    const llamada = toastMock.mock.calls.at(-1)!;
    return (llamada[2] as OpcionesToast | undefined)?.accion;
  }

  it('el módulo de pagos cambia al instante y ofrece "Deshacer", que también se guarda', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('switch', { name: 'Módulo pagos' }));

    await waitFor(() => expect(adminModule.adminApi.toggleModuloPagos).toHaveBeenCalledWith('neg-1', false));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock.mock.calls.at(-1)![0]).toBe('Módulo de pagos deshabilitado en Peluquería Test');
    const accion = accionDelUltimoToast();
    expect(accion?.etiqueta).toBe('Deshacer');

    accion!.onClick();
    await waitFor(() => expect(adminModule.adminApi.toggleModuloPagos).toHaveBeenLastCalledWith('neg-1', true));
    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith('Cambio deshecho: módulo de pagos habilitado en Peluquería Test')
    );
    // Deshacer no ofrece otro "Deshacer".
    expect(accionDelUltimoToast()).toBeUndefined();
    expect(screen.getByRole('switch', { name: 'Módulo pagos' })).toHaveAttribute('aria-checked', 'true');
  });

  it('el modo tester también se puede deshacer, enviando el valor absoluto', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('switch', { name: 'Tester' }));

    await waitFor(() => expect(adminModule.adminApi.setTester).toHaveBeenCalledWith('neg-1', true));
    await waitFor(() => expect(toastMock).toHaveBeenCalled());
    expect(toastMock.mock.calls.at(-1)![0]).toBe('Modo tester activado en Peluquería Test');
    accionDelUltimoToast()!.onClick();

    await waitFor(() => expect(adminModule.adminApi.setTester).toHaveBeenLastCalledWith('neg-1', false));
    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith('Cambio deshecho: modo tester desactivado en Peluquería Test')
    );
    expect(screen.getByRole('switch', { name: 'Tester' })).toHaveAttribute('aria-checked', 'false');
  });

  it('"Deshacer" de un aviso viejo restaura el valor previo de ese aviso, no alterna', async () => {
    const user = userEvent.setup();
    renderPage();
    const interruptor = await screen.findByRole('switch', { name: 'Tester' });

    // Aviso A: false → true.
    await user.click(interruptor);
    await waitFor(() => expect(interruptor).toHaveAttribute('aria-checked', 'true'));
    const deshacerA = accionDelUltimoToast()!;

    // Aviso B: true → false.
    await user.click(interruptor);
    await waitFor(() => expect(interruptor).toHaveAttribute('aria-checked', 'false'));
    expect(adminModule.adminApi.setTester).toHaveBeenLastCalledWith('neg-1', false);

    // Deshacer A vuelve al valor previo de A (false). Un "alternar" lo dejaría en true.
    deshacerA.onClick();
    await waitFor(() => expect(adminModule.adminApi.setTester).toHaveBeenCalledTimes(3));
    expect(adminModule.adminApi.setTester).toHaveBeenLastCalledWith('neg-1', false);
    await waitFor(() =>
      expect(toastMock).toHaveBeenLastCalledWith('Cambio deshecho: modo tester desactivado en Peluquería Test')
    );
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
  });

  it('"Confirmar correo" no aparece si el correo ya está verificado', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([{ ...mockNegocio, emailConfirmado: true }]);
    renderPage();
    expect(await screen.findByText('Correo verificado')).toBeInTheDocument();
    // Ni en la tarjeta ni dentro de "⋯".
    await user.click(screen.getByRole('button', { name: 'Más acciones de Peluquería Test' }));
    const menu = await screen.findByRole('dialog', { name: 'Más acciones de Peluquería Test' });
    expect(within(menu).getByRole('button', { name: 'Colores' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar correo/ })).not.toBeInTheDocument();
  });

  it('con el correo sin verificar, "Confirmar correo" pide confirmación antes de marcarlo', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      { ...mockNegocio, emailConfirmado: false, propietarioEmail: 'dueno@ejemplo.com' },
    ]);
    renderPage();
    // Lote 3: es una acción ocasional, vive en "⋯".
    await user.click(await screen.findByRole('button', { name: 'Más acciones de Peluquería Test' }));
    await user.click(await screen.findByRole('button', { name: /Confirmar correo/ }));
    expect(adminModule.adminApi.confirmarEmail).not.toHaveBeenCalled();

    const dialogo = await screen.findByRole('dialog', { name: '¿Confirmar el correo del propietario?' });
    expect(dialogo).toHaveTextContent('dueno@ejemplo.com');
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar correo' }));
    await waitFor(() => expect(adminModule.adminApi.confirmarEmail).toHaveBeenCalledWith('neg-1'));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Correo del propietario confirmado'));
  });
});

// ── Pendientes de activación (AP-07) ────────────────────────────────────────

describe('NegociosAdminPage — pendientes de activación', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Activo SA', activo: 1 }),
      negocio(2, { nombre: 'Suspendido SA', activo: 0 }),
      negocio(3, { nombre: 'Nuevo SA', activo: 0, planNombre: undefined, planId: undefined }),
    ]);
  });

  it('muestra primero los registros nuevos sin activar, con su insignia', async () => {
    renderPage();
    await screen.findByText('Nuevo SA');

    const texto = document.body.textContent ?? '';
    expect(texto.indexOf('Nuevo SA')).toBeLessThan(texto.indexOf('Activo SA'));
    expect(texto.indexOf('Activo SA')).toBeLessThan(texto.indexOf('Suspendido SA'));
    expect(screen.getByText('Pendiente de activación')).toBeInTheDocument();
  });

  it('muestra la fecha de registro, si verificó el correo y el plan elegido (B23, B20)', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(3, {
        nombre: 'Nuevo SA', activo: 0, planNombre: undefined, planId: undefined,
        fechaCreacion: '2026-10-20T15:00:00Z', emailConfirmado: true, planSolicitado: 'pro',
      }),
      negocio(4, {
        nombre: 'Otro SA', activo: 0, planNombre: undefined, planId: undefined,
        fechaCreacion: '2026-10-21T15:00:00Z', emailConfirmado: false,
      }),
    ]);
    renderPage();
    await screen.findByText('Nuevo SA');

    expect(screen.getByText(/Registrado el 20 de octubre de 2026/)).toBeInTheDocument();
    expect(screen.getByText('Correo verificado')).toBeInTheDocument();
    // En la tarjeta: "Requiere atención" (lote 4) también nombra el motivo.
    expect(within(screen.getByRole('article', { name: 'Otro SA' })).getByText('Correo sin verificar')).toBeInTheDocument();
    expect(screen.getByText('Eligió el plan Pro')).toBeInTheDocument();
    // El registro más reciente va primero en la cola.
    const texto = document.body.textContent ?? '';
    expect(texto.indexOf('Otro SA')).toBeLessThan(texto.indexOf('Nuevo SA'));
  });
  it('el filtro "Pendientes de activación" deja fuera a los desactivados', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Nuevo SA');

    await user.click(screen.getByRole('button', { name: 'Estado' }));
    await user.click(screen.getByRole('option', { name: 'Pendientes de activación' }));

    await waitFor(() => expect(screen.queryByText('Suspendido SA')).not.toBeInTheDocument());
    expect(screen.queryByText('Activo SA')).not.toBeInTheDocument();
    expect(screen.getByText('Nuevo SA')).toBeInTheDocument();
  });
});

// ── KPI "Con plan" ──────────────────────────────────────────────────────────

describe('NegociosAdminPage — KPI "Con suscripción vigente"', () => {
  it('no cuenta los negocios de prueba, igual que "Ingreso mensual"', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      { ...mockNegocio, id: 'neg-1', esTester: false },
      { ...mockNegocio, id: 'neg-tester', nombre: 'Tester SA', esTester: true },
    ]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      { ...mockSuscripcion, negocioId: 'neg-1' },
      // El backend ya da 0 de ingreso a un tester.
      { ...mockSuscripcion, negocioId: 'neg-tester', negocioNombre: 'Tester SA', esTester: true, ingresoMensual: 0 },
    ]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);

    renderPage();

    const tarjeta = (await screen.findByText('Con suscripción vigente')).closest('div')!;
    // Dos suscripciones con plan, pero una es de un negocio tester.
    expect(within(tarjeta).getByText('1')).toBeInTheDocument();
    expect(within(tarjeta).getByText('de 1 con plan asignado')).toBeInTheDocument();
  });
});

describe('NegociosAdminPage — Nuevo negocio (AP-23)', () => {
  it('comprueba el slug en vivo y no deja crear con uno ocupado', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
    vi.mocked(verificarSlug).mockResolvedValue({ disponible: false });
    renderPage();

    await user.click(await screen.findByRole('button', { name: '+ Nuevo negocio' }));
    const dialogo = await screen.findByRole('dialog');
    await user.type(within(dialogo).getByPlaceholderText('barberia-luis'), 'barberia-luis');

    expect(await within(dialogo).findByText(/Ya está en uso/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(verificarSlug).toHaveBeenLastCalledWith('barberia-luis');
    expect(within(dialogo).getByRole('button', { name: 'Crear negocio e invitar' })).toBeDisabled();
  });

  // Lote 5 (I8): slug propuesto desde el nombre y propietario invitado en el mismo paso.
  it('propone el slug desde el nombre y crea el negocio con su propietario invitado', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
    vi.mocked(verificarSlug).mockResolvedValue({ disponible: true });
    vi.mocked(adminModule.adminApi.crearNegocio).mockResolvedValue({
      id: 'nuevo', nombre: 'Estética Ñandú', slug: 'estetica-nandu', propietarioEmail: 'ana@nandu.mx', invitacionEnviada: true,
    } as never);
    renderPage();

    await user.click(await screen.findByRole('button', { name: '+ Nuevo negocio' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo negocio' });
    await user.type(within(dialogo).getByLabelText('Nombre *', { selector: '#nuevo-nombre' }), 'Estética Ñandú');
    expect(within(dialogo).getByPlaceholderText('barberia-luis')).toHaveValue('estetica-nandu');
    // Sin contraseña: el propietario la crea desde la invitación.
    expect(within(dialogo).queryByLabelText(/Contraseña/)).not.toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText('Nombre *', { selector: '#nuevo-prop-nombre' }), 'Ana');
    await user.type(within(dialogo).getByLabelText('Correo de acceso del propietario *'), 'ana@nandu.mx');
    expect(await within(dialogo).findByText('Disponible', {}, { timeout: 2000 })).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Crear negocio e invitar' }));

    await waitFor(() => expect(adminModule.adminApi.crearNegocio).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Estética Ñandú',
      slug: 'estetica-nandu',
      propietario: { nombre: 'Ana', apellido: '', email: 'ana@nandu.mx' },
    })));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Negocio creado. Enviamos la invitación a ana@nandu.mx.'));
  });

  it('un slug editado a mano ya no sigue al nombre; sin invitar, no manda propietario', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
    vi.mocked(verificarSlug).mockResolvedValue({ disponible: true });
    vi.mocked(adminModule.adminApi.crearNegocio).mockReset().mockResolvedValue({ id: 'n', nombre: 'Spa', slug: 'mi-spa' } as never);
    renderPage();

    await user.click(await screen.findByRole('button', { name: '+ Nuevo negocio' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Nuevo negocio' });
    const slug = within(dialogo).getByPlaceholderText('barberia-luis');
    await user.type(slug, 'mi-spa');
    await user.type(within(dialogo).getByLabelText('Nombre *', { selector: '#nuevo-nombre' }), 'Spa Central');
    expect(slug).toHaveValue('mi-spa');
    await user.click(within(dialogo).getByRole('checkbox', { name: /Invitar al propietario ahora/ }));
    expect(within(dialogo).queryByLabelText('Correo de acceso del propietario *')).not.toBeInTheDocument();
    expect(await within(dialogo).findByText('Disponible', {}, { timeout: 2000 })).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Crear negocio' }));

    await waitFor(() => expect(adminModule.adminApi.crearNegocio).toHaveBeenCalled());
    expect(vi.mocked(adminModule.adminApi.crearNegocio).mock.calls[0][0].propietario).toBeUndefined();
  });
});

describe('NegociosAdminPage — error de métricas', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
  });

  it('un fallo de métricas muestra el error con Reintentar en vez de KPIs en cero', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas)
      .mockReset()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    const user = userEvent.setup();
    renderPage();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudieron cargar las métricas del panel.');
    expect(screen.queryByText('Ingreso mensual')).not.toBeInTheDocument();
    expect(screen.queryByText(/registrados? en total/)).not.toBeInTheDocument();
    expect(screen.queryByText('No hay negocios registrados')).not.toBeInTheDocument();

    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Peluquería Test')).toBeInTheDocument();
    expect(screen.getByText('Ingreso mensual')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(adminModule.adminApi.obtenerMetricas).toHaveBeenCalledTimes(2);
  });

  it('un fallo de suscripciones también muestra el error en vez de ingresos en cero', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockRejectedValue(new Error('500'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las métricas del panel.');
    expect(screen.queryByText('Ingreso mensual')).not.toBeInTheDocument();
  });
});

// ── Lote 3: patrones compartidos ────────────────────────────────────────────

const pagoDe = (extra: Partial<adminModule.PagoSuscripcionDto> = {}): adminModule.PagoSuscripcionDto => ({
  id: 'pago-1',
  negocioId: 'neg-1',
  negocioNombre: 'Peluquería Test',
  registradoPorEmail: 'admin@appointva.com',
  fechaPago: '2026-10-01T12:00:00',
  periodoDesde: '2026-10-01T00:00:00',
  periodoHasta: '2026-11-01T00:00:00',
  mesesPagados: 1,
  monto: 449,
  notas: 'Transferencia',
  numeroPago: 3,
  ...extra,
});

function simularTelefono() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width: 639.98px'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('NegociosAdminPage — Lote 3: carga, vacío y encabezado', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
  });

  it('mientras carga muestra el skeleton de KPIs y de tarjetas, no "Cargando negocios..." (I5)', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockReset().mockImplementation(() => new Promise(() => {}));
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    renderPage();

    expect(await screen.findByRole('status', { name: 'Cargando métricas' })).toBeInTheDocument();
    const tarjetas = screen.getByRole('status', { name: 'Cargando negocios' });
    expect(tarjetas.querySelectorAll('[data-variante="tarjeta-negocio"]').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Cargando negocios\.\.\./)).not.toBeInTheDocument();
    expect(screen.queryByText('No hay negocios registrados')).not.toBeInTheDocument();
  });

  it('el título es "Negocios", como el menú, y Facturación ya no es una pestaña (M2, lote 4)', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Negocios' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'General' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Facturación' })).not.toBeInTheDocument();
    expect(screen.queryByText('Panel de negocios')).not.toBeInTheDocument();
  });

  it('sin negocios, el vacío trae su propio botón para crear el primero (M10)', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No hay negocios registrados')).toBeInTheDocument();
    expect(screen.queryByText(/Crea el primero con/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear el primer negocio' }));
    expect(await screen.findByRole('dialog', { name: 'Nuevo negocio' })).toBeInTheDocument();
  });
});

describe('NegociosAdminPage — Lote 3: acciones de la tarjeta en "⋯"', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([{ ...mockNegocio, emailConfirmado: false }]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  });

  it('a la vista quedan Suscripción, Desactivar y Propietario; lo ocasional va al menú', async () => {
    renderPage();
    const tarjeta = await screen.findByRole('article', { name: 'Peluquería Test' });

    expect(within(tarjeta).getByRole('button', { name: 'Suscripción' })).toBeInTheDocument();
    expect(within(tarjeta).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
    expect(within(tarjeta).getByRole('button', { name: 'Propietario' })).toBeInTheDocument();
    // Antes eran botones sueltos en la tarjeta.
    expect(within(tarjeta).queryByRole('button', { name: /Colores/ })).not.toBeInTheDocument();
    expect(within(tarjeta).queryByRole('link', { name: /Ver booking/ })).not.toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: /Eliminar/ })).not.toBeInTheDocument();
    expect(within(tarjeta).queryByRole('button', { name: /Confirmar correo/ })).not.toBeInTheDocument();
  });

  it('el menú lista las secundarias y deja "Eliminar negocio" al final, en rojo y tras una línea', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Más acciones de Peluquería Test' }));

    const menu = await screen.findByRole('dialog', { name: 'Más acciones de Peluquería Test' });
    const nombres = within(menu).getAllByRole('button').map((b) => b.textContent?.trim()).filter((t) => t);
    expect(nombres).toEqual(['Confirmar correo', 'Colores', 'Ver página de reservas', 'Eliminar negocio']);
    const eliminar = within(menu).getByRole('button', { name: 'Eliminar negocio' });
    expect(eliminar.className).toContain('text-red-700');
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
  });

  it('"Eliminar negocio" abre la confirmación con cifras que pide el nombre', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerImpactoEliminacion).mockResolvedValue({
      negocioId: 'neg-1', activo: true, citasProximas: 0, citasPasadas: 1, clientes: 1,
      empleados: 1, servicios: 1, pagos: 0, imagenes: 0, resenas: 0,
    });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Más acciones de Peluquería Test' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar negocio' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Eliminar negocio' });
    expect(await within(dialogo).findByText('1 cliente')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
    await user.type(within(dialogo).getByPlaceholderText('Peluquería Test'), 'Peluquería Test');
    expect(within(dialogo).getByRole('button', { name: 'Eliminar definitivamente' })).toBeEnabled();
  });

  it('"Ver página de reservas" abre /b/:slug en otra pestaña', async () => {
    const user = userEvent.setup();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Más acciones de Peluquería Test' }));
    await user.click(await screen.findByRole('button', { name: 'Ver página de reservas' }));
    expect(abrir).toHaveBeenCalledWith('/b/peluqueria-test', '_blank', 'noopener,noreferrer');
    abrir.mockRestore();
  });

  it('"Colores" abre su modal con el pie compartido', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Más acciones de Peluquería Test' }));
    await user.click(await screen.findByRole('button', { name: 'Colores' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Colores del negocio' });
    expect(within(dialogo).getByRole('button', { name: 'Guardar colores' }).parentElement).toHaveClass('flex-col-reverse');
  });
});

describe('NegociosAdminPage — lote 4: tarjetas en el teléfono', () => {
  beforeEach(() => {
    simularTelefono();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('en el teléfono siempre son tarjetas, aunque en escritorio se haya elegido la tabla', async () => {
    localStorage.setItem('admin-negocios-vista', 'tabla');
    renderPage();

    expect(await screen.findByRole('article', { name: 'Peluquería Test' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Sin selector de vista: en 390px no hay tabla que elegir.
    expect(screen.queryByRole('group', { name: 'Vista de la lista' })).not.toBeInTheDocument();
  });

  it('la cabecera de la tarjeta lleva a la ficha del negocio', async () => {
    renderPage();
    const tarjeta = await screen.findByRole('article', { name: 'Peluquería Test' });
    expect(within(tarjeta).getByRole('link', { name: /Ver ficha de Peluquería Test/ }))
      .toHaveAttribute('href', '/admin/negocios/neg-1');
  });
});

describe('ModalSuscripcion — Lote 3: historial y planes', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([mockSuscripcion]);
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
    vi.mocked(adminModule.adminApi.eliminarPago).mockReset().mockResolvedValue(undefined as never);
    toastMock.mockReset();
  });

  async function abrirModal(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    const tarjeta = await screen.findByRole('article', { name: 'Peluquería Test' });
    await user.click(within(tarjeta).getByRole('button', { name: 'Suscripción' }));
  }

  async function abrirPagos() {
    const user = userEvent.setup();
    await abrirModal(user);
    const dialogo = await screen.findByRole('dialog', { name: 'Suscripción — Peluquería Test' });
    await user.click(within(dialogo).getByRole('button', { name: 'Pagos' }));
    return { user, dialogo };
  }

  it('sin pagos, el historial usa EmptyState en vez de texto suelto', async () => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    const { dialogo } = await abrirPagos();
    expect(await within(dialogo).findByText('Sin pagos registrados')).toBeInTheDocument();
    expect(within(dialogo).getByText(/Cuando registres el primero/)).toBeInTheDocument();
  });

  it('mientras carga, el historial muestra filas en gris', async () => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockImplementation(() => new Promise(() => {}));
    const { dialogo } = await abrirPagos();
    expect(within(dialogo).getByRole('status', { name: 'Cargando historial de pagos' })).toBeInTheDocument();
    expect(within(dialogo).queryByText('Cargando historial…')).not.toBeInTheDocument();
  });

  it('si el historial falla, ErrorCarga con Reintentar', async () => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockRejectedValueOnce(new Error('500')).mockResolvedValue([pagoDe()]);
    const { user, dialogo } = await abrirPagos();
    const alerta = await within(dialogo).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo cargar el historial de pagos.');
    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(await within(dialogo).findByText('$449')).toBeInTheDocument();
  });

  it('cada pago muestra monto y período con los formatos compartidos, y sus acciones van en "⋯"', async () => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([pagoDe()]);
    const { user, dialogo } = await abrirPagos();

    expect(await within(dialogo).findByText('$449')).toBeInTheDocument();
    expect(within(dialogo).getByText(/01 oct 2026 – 01 nov 2026/)).toBeInTheDocument();
    expect(within(dialogo).queryByText(/MXN \$|449\.00/)).not.toBeInTheDocument();

    await user.click(within(dialogo).getByRole('button', { name: 'Acciones del pago 003' }));
    const menu = await screen.findByRole('dialog', { name: 'Acciones del pago 003' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent?.trim()).filter(Boolean))
      .toEqual(['Imprimir comprobante', 'Editar pago', 'Eliminar pago']);
  });

  it('eliminar un pago pide confirmación con el monto antes de borrarlo', async () => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([pagoDe()]);
    const { user, dialogo } = await abrirPagos();

    await user.click(await within(dialogo).findByRole('button', { name: 'Acciones del pago 003' }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar pago' }));
    expect(adminModule.adminApi.eliminarPago).not.toHaveBeenCalled();

    const confirmar = await screen.findByRole('dialog', { name: '¿Eliminar el pago #003?' });
    expect(confirmar).toHaveTextContent('$449');
    await user.click(within(confirmar).getByRole('button', { name: 'Eliminar pago' }));
    await waitFor(() => expect(adminModule.adminApi.eliminarPago).toHaveBeenCalledWith('pago-1'));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Pago eliminado'));
  });

  it('la edición de un pago usa campos de 44px con su etiqueta asociada (M5)', async () => {
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([pagoDe()]);
    const { user, dialogo } = await abrirPagos();

    await user.click(await within(dialogo).findByRole('button', { name: 'Acciones del pago 003' }));
    await user.click(await screen.findByRole('button', { name: 'Editar pago' }));
    const monto = within(dialogo).getAllByLabelText('Monto (MXN)').find((el) => el.id.startsWith('pago-pago-1'))!;
    expect(monto).toHaveValue('449');
    expect(monto.className).toContain('min-h-[44px]');
    expect(within(dialogo).getByLabelText('Período desde')).toHaveValue('2026-10-01');
  });

  it('mientras llegan los planes, pastillas en gris en vez de "Cargando planes…"', async () => {
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockImplementation(() => new Promise(() => {}));
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    const user = userEvent.setup();
    await abrirModal(user);
    const dialogo = await screen.findByRole('dialog', { name: 'Suscripción — Peluquería Test' });
    expect(within(dialogo).getByRole('status', { name: 'Cargando planes' })).toBeInTheDocument();
    expect(within(dialogo).queryByText('Cargando planes…')).not.toBeInTheDocument();
  });

  it('si los planes no llegan, se dice y se reintenta', async () => {
    vi.mocked(adminModule.adminApi.obtenerPlanes).mockReset().mockRejectedValue(new Error('500'));
    vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
    const user = userEvent.setup();
    await abrirModal(user);
    const dialogo = await screen.findByRole('dialog', { name: 'Suscripción — Peluquería Test' });
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('No se pudieron cargar los planes.');
  });
});
