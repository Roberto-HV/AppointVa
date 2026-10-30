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
    activar: vi.fn(),
    desactivar: vi.fn(),
    setSector: vi.fn(),
    setPlan: vi.fn(),
  },
}));

vi.mock('../../api/auth', () => ({
  verificarSlug: vi.fn().mockResolvedValue({ disponible: true }),
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
    expect(screen.getByRole('alert')).toHaveTextContent('cambia el vocabulario');

    await user.click(screen.getByRole('button', { name: 'Cambiar sector' }));
    await waitFor(() => expect(adminModule.adminApi.setSector).toHaveBeenCalledWith('neg-1', 'salud'));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Sector actualizado: Salud'));
  });

  it('los empleados extra avisan al guardar y no se guardan si no cambiaron', async () => {
    await abrirSuscripcion();
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input, { target: { value: '0' } });
    expect(adminModule.adminApi.setEmpleadosExtra).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input, { target: { value: '2' } });
    await waitFor(() => expect(adminModule.adminApi.setEmpleadosExtra).toHaveBeenCalledWith('neg-1', 2));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith('Empleados extra actualizados: 2'));
  });

  it('un error al guardar empleados extra se muestra', async () => {
    vi.mocked(adminModule.adminApi.setEmpleadosExtra).mockRejectedValue(new Error('red'));
    await abrirSuscripcion();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.blur(input, { target: { value: '3' } });
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith('No se pudieron actualizar los empleados extra.', 'error')
    );
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
    expect(screen.getByText('Correo sin verificar')).toBeInTheDocument();
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
    expect(within(dialogo).getByRole('button', { name: 'Crear negocio' })).toBeDisabled();
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
    expect(screen.queryByText('Ingresos est.')).not.toBeInTheDocument();
    expect(screen.queryByText(/registrados? en total/)).not.toBeInTheDocument();
    expect(screen.queryByText('No hay negocios registrados')).not.toBeInTheDocument();

    await user.click(within(alerta).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Peluquería Test')).toBeInTheDocument();
    expect(screen.getByText('Ingresos est.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(adminModule.adminApi.obtenerMetricas).toHaveBeenCalledTimes(2);
  });

  it('un fallo de suscripciones también muestra el error en vez de ingresos en cero', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([mockNegocio]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockRejectedValue(new Error('500'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las métricas del panel.');
    expect(screen.queryByText('Ingresos est.')).not.toBeInTheDocument();
  });
});
