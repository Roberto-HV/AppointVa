import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import NegociosAdminPage from './NegociosAdminPage';
import * as adminModule from '../../api/admin';
import type { NegocioMetricasDto, SuscripcionResumenDto } from '../../api/admin';

// Lote 4: la lista como tabla densa en escritorio, su orden, su búsqueda por el
// correo del propietario, su paginación y la franja "Requiere atención".

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    obtenerPlanes: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
  },
}));

vi.mock('../../api/auth', () => ({
  verificarSlug: vi.fn().mockResolvedValue({ disponible: true }),
}));

vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({ toast: vi.fn() }),
}));

function negocio(i: number, extra: Partial<NegocioMetricasDto> = {}): NegocioMetricasDto {
  return {
    id: `neg-${i}`,
    nombre: `Negocio ${String(i).padStart(2, '0')}`,
    slug: `negocio-${i}`,
    activo: 1,
    maxCitasMes: 100,
    maxEmpleados: 3,
    citasMes: 10,
    empleadosActivos: 1,
    emailsMes: 0,
    planNombre: 'Pro',
    planId: 'plan-pro',
    propietarioEmail: `dueno${i}@correo.mx`,
    propietarioNombre: `Dueño ${i}`,
    emailConfirmado: true,
    fechaCreacion: '2026-01-01T12:00:00Z',
    ...extra,
  };
}

function suscripcion(negocioId: string, extra: Partial<SuscripcionResumenDto> = {}): SuscripcionResumenDto {
  return {
    negocioId,
    negocioNombre: negocioId,
    negocioSlug: negocioId,
    fechaVencimiento: '2026-12-31T00:00:00Z',
    estado: 'Activa',
    diasRestantes: 60,
    totalPagos: 1,
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
    ...extra,
  };
}

/** Muestra la URL actual para comprobar el filtro guardado en `?atencion=`. */
function Ubicacion() {
  const { pathname, search } = useLocation();
  return <output data-testid="ubicacion">{pathname + search}</output>;
}

function renderPage(ruta = '/admin') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin" element={<><NegociosAdminPage /><Ubicacion /></>} />
          <Route path="/admin/negocios/:id" element={<Ubicacion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** Nombres de negocio en el orden en que aparecen en la tabla. */
function nombresEnTabla() {
  const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1);
  return filas.map((f) => within(f).getAllByRole('link')[0].textContent);
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue([]);
  vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([]);
});
afterEach(() => localStorage.clear());

describe('Negocios — tabla densa en escritorio', () => {
  it('es la vista por defecto, con una fila por negocio y sus columnas', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Barbería Luis', citasMes: 42, empleadosActivos: 2, propietarioEmail: 'luis@barberia.mx' }),
    ]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([suscripcion('neg-1')]);
    renderPage();

    const tabla = await screen.findByRole('table');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    for (const columna of ['Negocio', 'Propietario', 'Plan', 'Suscripción', 'Vence', 'Citas del mes', 'Empleados', 'Estado', 'Alta']) {
      expect(within(tabla).getByRole('columnheader', { name: new RegExp(columna) })).toBeInTheDocument();
    }
    const fila = within(tabla).getByRole('link', { name: 'Barbería Luis' }).closest('tr')!;
    expect(fila).toHaveTextContent('luis@barberia.mx');
    expect(fila).toHaveTextContent('42 / 100');
    expect(fila).toHaveTextContent('2 / 3');
    expect(within(fila).getByText('Activo')).toBeInTheDocument();
    expect(within(fila).getByText(/Activa · 2 meses/)).toBeInTheDocument();
  });

  it('ordena por una columna al pulsarla y la vuelve a invertir; aria-sort lo anuncia', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Alfa', citasMes: 5 }),
      negocio(2, { nombre: 'Beta', citasMes: 50 }),
      negocio(3, { nombre: 'Gama', citasMes: 20 }),
    ]);
    renderPage();
    await screen.findByRole('table');

    const citas = screen.getByRole('columnheader', { name: /Citas del mes/ });
    expect(citas).toHaveAttribute('aria-sort', 'none');

    // Cifras: lo mayor primero al primer clic.
    await user.click(within(citas).getByRole('button'));
    expect(citas).toHaveAttribute('aria-sort', 'descending');
    expect(nombresEnTabla()).toEqual(['Beta', 'Gama', 'Alfa']);

    await user.click(within(citas).getByRole('button'));
    expect(citas).toHaveAttribute('aria-sort', 'ascending');
    expect(nombresEnTabla()).toEqual(['Alfa', 'Gama', 'Beta']);

    // Texto: de la A a la Z al primer clic.
    const nombre = screen.getByRole('columnheader', { name: /Negocio/ });
    await user.click(within(nombre).getByRole('button'));
    expect(nombre).toHaveAttribute('aria-sort', 'ascending');
    expect(citas).toHaveAttribute('aria-sort', 'none');
    expect(nombresEnTabla()).toEqual(['Alfa', 'Beta', 'Gama']);
  });

  it('ordena por vencimiento y deja al final a los que no tienen fecha', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Sin fecha' }),
      negocio(2, { nombre: 'Vence tarde' }),
      negocio(3, { nombre: 'Vence pronto' }),
    ]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      suscripcion('neg-1', { estado: 'SinSuscripcion', fechaVencimiento: null, diasRestantes: null }),
      suscripcion('neg-2', { fechaVencimiento: '2027-03-01T00:00:00Z' }),
      suscripcion('neg-3', { estado: 'PorVencer', fechaVencimiento: '2026-11-08T00:00:00Z', diasRestantes: 5 }),
    ]);
    renderPage();
    await screen.findByRole('table');

    const vence = screen.getByRole('columnheader', { name: /Vence/ });
    await user.click(within(vence).getByRole('button'));
    expect(nombresEnTabla()).toEqual(['Vence pronto', 'Vence tarde', 'Sin fecha']);
    await user.click(within(vence).getByRole('button'));
    expect(nombresEnTabla()).toEqual(['Vence tarde', 'Vence pronto', 'Sin fecha']);
  });

  it('busca también por el correo y el nombre del propietario', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Barbería Luis', propietarioEmail: 'luis@barberia.mx', propietarioNombre: 'Luis Pérez' }),
      negocio(2, { nombre: 'Salón Aramis', propietarioEmail: 'ana@aramis.mx', propietarioNombre: 'Ana Gómez' }),
    ]);
    renderPage();
    await screen.findByRole('link', { name: 'Barbería Luis' });

    const buscador = screen.getByRole('searchbox', { name: 'Buscar negocio' });
    await user.type(buscador, 'ana@aramis');
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Barbería Luis' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Salón Aramis' })).toBeInTheDocument();

    // Sin acentos ni mayúsculas: "perez" encuentra a "Luis Pérez".
    await user.clear(buscador);
    await user.type(buscador, 'PEREZ');
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Salón Aramis' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Barbería Luis' })).toBeInTheDocument();
  });

  it('pagina la tabla a 15 filas y el orden se aplica a todas, no solo a la página', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue(
      Array.from({ length: 18 }, (_, i) => negocio(i + 1, { citasMes: i + 1 }))
    );
    renderPage();
    await screen.findByRole('table');

    expect(nombresEnTabla()).toHaveLength(15);
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('18 negocios · página 1 de 2');

    await user.click(within(screen.getByRole('columnheader', { name: /Citas del mes/ })).getByRole('button'));
    // La página 1 trae las 15 con más citas: la 18 primero, la 3 al final.
    expect(nombresEnTabla()[0]).toBe('Negocio 18');
    expect(nombresEnTabla()[14]).toBe('Negocio 04');

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(nombresEnTabla()).toEqual(['Negocio 03', 'Negocio 02', 'Negocio 01']);
  });

  it('cambiar el orden estando en la página 2 vuelve a la página 1', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue(
      Array.from({ length: 18 }, (_, i) => negocio(i + 1, { citasMes: i + 1 }))
    );
    renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('página 2 de 2');

    await user.click(within(screen.getByRole('columnheader', { name: /Citas del mes/ })).getByRole('button'));
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('página 1 de 2');
    expect(nombresEnTabla()[0]).toBe('Negocio 18');
  });

  it('escribir en la búsqueda estando en la página 2 vuelve a la página 1', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue(
      Array.from({ length: 35 }, (_, i) => negocio(i + 1))
    );
    renderPage();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('página 2 de 3');

    // "negocio" coincide con los 35: la lista no se encoge y aun así se vuelve a la 1.
    await user.type(screen.getByRole('searchbox', { name: 'Buscar negocio' }), 'negocio');
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('35 negocios · página 1 de 3'));
  });

  it('el nombre y la fila llevan a la ficha del negocio', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1, { nombre: 'Barbería Luis' })]);
    renderPage();

    const enlace = await screen.findByRole('link', { name: 'Barbería Luis' });
    expect(enlace).toHaveAttribute('href', '/admin/negocios/neg-1');

    // Un clic en cualquier parte de la fila (aquí, el correo del propietario).
    await user.click(within(enlace.closest('tr')!).getByText('dueno1@correo.mx'));
    expect(await screen.findByTestId('ubicacion')).toHaveTextContent('/admin/negocios/neg-1');
  });

  it('el "⋯" de la fila tiene "Ver ficha" y las acciones de la tarjeta, y abren sus modales', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1, { nombre: 'Barbería Luis', emailConfirmado: false })]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([suscripcion('neg-1')]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Acciones de Barbería Luis' }));
    const menu = await screen.findByRole('dialog', { name: 'Acciones de Barbería Luis' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent?.trim()).filter(Boolean)).toEqual([
      'Ver ficha', 'Suscripción', 'Propietario', 'Desactivar', 'Confirmar correo', 'Colores', 'Ver página de reservas', 'Eliminar negocio',
    ]);

    await user.click(within(menu).getByRole('button', { name: 'Desactivar' }));
    // La misma confirmación de siempre: no desactiva con un clic.
    expect(await screen.findByRole('dialog', { name: '¿Desactivar Barbería Luis?' })).toBeInTheDocument();
    expect(adminModule.adminApi.desactivar).not.toHaveBeenCalled();
  });

  it('el selector cambia a tarjetas y lo recuerda en este navegador', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1)]);
    const { unmount } = renderPage();
    await screen.findByRole('table');

    const grupo = screen.getByRole('group', { name: 'Vista de la lista' });
    expect(within(grupo).getByRole('button', { name: 'Tabla' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(grupo).getByRole('button', { name: 'Tarjetas' }));
    expect(await screen.findByRole('article', { name: 'Negocio 01' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(localStorage.getItem('admin-negocios-vista')).toBe('tarjetas');

    unmount();
    renderPage();
    expect(await screen.findByRole('article', { name: 'Negocio 01' })).toBeInTheDocument();
  });

  it('si el navegador no deja guardar la vista, la tabla sigue funcionando', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(1)]);
    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tarjetas' }));
    expect(await screen.findByRole('article', { name: 'Negocio 01' })).toBeInTheDocument();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('Negocios — franja "Requiere atención"', () => {
  beforeEach(() => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      negocio(1, { nombre: 'Pendiente SA', activo: 0, planNombre: undefined, planId: undefined, emailConfirmado: false }),
      negocio(2, { nombre: 'Vencida SA' }),
      negocio(3, { nombre: 'Por Vencer SA' }),
      negocio(4, { nombre: 'Sin Pago SA' }),
      negocio(5, { nombre: 'Al Corriente SA' }),
      // Un tester con la suscripción vencida no es un cobro pendiente.
      negocio(6, { nombre: 'Tester SA', esTester: true }),
      // Uno desactivado tampoco se cobra.
      negocio(7, { nombre: 'Baja SA', activo: 0 }),
    ]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([
      suscripcion('neg-1', { estado: 'SinSuscripcion', planNombre: null, fechaVencimiento: null, diasRestantes: null }),
      suscripcion('neg-2', { estado: 'Vencida', diasRestantes: -3, suscripcionVigente: false }),
      suscripcion('neg-3', { estado: 'PorVencer', diasRestantes: 4 }),
      suscripcion('neg-4', { estado: 'SinSuscripcion', fechaVencimiento: null, diasRestantes: null, suscripcionVigente: false }),
      suscripcion('neg-5'),
      suscripcion('neg-6', { estado: 'Vencida', esTester: true }),
      suscripcion('neg-7', { estado: 'Vencida' }),
    ]);
  });

  function franja() {
    return screen.findByRole('region', { name: 'Requiere atención' });
  }

  it('cuenta cada motivo sin contar testers ni negocios dados de baja', async () => {
    renderPage();
    const f = await franja();
    expect(within(f).getByRole('button', { name: '1 Pendientes de activación' })).toBeInTheDocument();
    expect(within(f).getByRole('button', { name: '1 Suscripción vencida' })).toBeInTheDocument();
    expect(within(f).getByRole('button', { name: '1 Por vencer' })).toBeInTheDocument();
    expect(within(f).getByRole('button', { name: '1 Plan sin pago' })).toBeInTheDocument();
    expect(within(f).getByRole('button', { name: '1 Correo sin verificar' })).toBeInTheDocument();
  });

  it('un contador filtra la lista; pulsarlo otra vez la devuelve completa', async () => {
    const user = userEvent.setup();
    renderPage();
    const f = await franja();

    const vencidas = within(f).getByRole('button', { name: '1 Suscripción vencida' });
    await user.click(vencidas);
    expect(vencidas).toHaveAttribute('aria-pressed', 'true');
    expect(nombresEnTabla()).toEqual(['Vencida SA']);
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/admin?atencion=vencidas');

    await user.click(vencidas);
    expect(vencidas).toHaveAttribute('aria-pressed', 'false');
    expect(nombresEnTabla()).toHaveLength(7);
    expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\/admin$/);
  });

  it('el filtro llega por la URL (el contador del menú enlaza así) y "Limpiar" lo quita', async () => {
    const user = userEvent.setup();
    renderPage('/admin?atencion=pendientes');
    await franja();
    expect(nombresEnTabla()).toEqual(['Pendiente SA']);

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(nombresEnTabla()).toHaveLength(7));
  });

  it('combina con la búsqueda y ofrece volver a todos si no queda nada', async () => {
    const user = userEvent.setup();
    renderPage('/admin?atencion=porVencer');
    await franja();
    await user.type(screen.getByRole('searchbox', { name: 'Buscar negocio' }), 'Vencida SA');
    expect(await screen.findByText('Ningún negocio coincide con los filtros actuales.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos los negocios' }));
    await waitFor(() => expect(nombresEnTabla()).toHaveLength(7));
  });

  it('pulsar un contador estando en la página 2 vuelve a la página 1', async () => {
    const user = userEvent.setup();
    // 35 negocios; 20 por vencer: el filtro sigue teniendo dos páginas, así que
    // el acotado del hook no basta para volver a la 1.
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue(
      Array.from({ length: 35 }, (_, i) => negocio(i + 1))
    );
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue(
      Array.from({ length: 35 }, (_, i) => suscripcion(`neg-${i + 1}`, i < 20 ? { estado: 'PorVencer', diasRestantes: 4 } : {}))
    );
    renderPage();
    const f = await franja();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('página 2 de 3');

    await user.click(within(f).getByRole('button', { name: '20 Por vencer' }));
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toHaveTextContent('20 negocios · página 1 de 2');
  });

  it('sin nada pendiente, la franja no aparece', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio(5, { nombre: 'Al Corriente SA' })]);
    vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([suscripcion('neg-5')]);
    renderPage();
    await screen.findByRole('table');
    expect(screen.queryByRole('region', { name: 'Requiere atención' })).not.toBeInTheDocument();
  });
});
