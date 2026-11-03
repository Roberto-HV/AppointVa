import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NegocioDetalleAdminPage from './NegocioDetalleAdminPage';
import * as adminModule from '../../api/admin';
import type { NegocioMetricasDto, SuscripcionResumenDto } from '../../api/admin';

// Lote 4: la ficha del negocio reúne lo que estaba en la tarjeta y sus modales.
// Las acciones son las mismas (mismas llamadas, mismas confirmaciones): aquí se
// comprueba que siguen funcionando desde la ficha.

vi.mock('../../api/admin', () => ({
  adminApi: {
    obtenerMetricas: vi.fn(),
    obtenerSuscripciones: vi.fn(),
    obtenerPagos: vi.fn(),
    obtenerPlanes: vi.fn(),
    obtenerAuditLogs: vi.fn(),
    obtenerCatalogoAuditoria: vi.fn(),
    activar: vi.fn(),
    desactivar: vi.fn(),
    confirmarEmail: vi.fn(),
    toggleModuloPagos: vi.fn(),
    setTester: vi.fn(),
    setPlan: vi.fn(),
    eliminarNegocio: vi.fn(),
    restablecerPasswordPropietario: vi.fn(),
    crearPropietario: vi.fn(),
  },
}));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('../../store/toastStore', () => ({
  useToastStore: () => ({ toast: toastMock }),
}));

const negocio: NegocioMetricasDto = {
  id: 'neg-1',
  nombre: 'Barbería Luis',
  slug: 'barberia-luis',
  activo: 1,
  maxCitasMes: 100,
  maxEmpleados: 3,
  citasMes: 42,
  empleadosActivos: 2,
  emailsMes: 7,
  planNombre: 'Basico',
  planId: 'plan-basico',
  moduloPagosHabilitado: false,
  esTester: false,
  email: 'contacto@barberia.mx',
  propietarioEmail: 'luis@barberia.mx',
  propietarioNombre: 'Luis Pérez',
  emailConfirmado: false,
  fechaCreacion: '2026-10-20T15:00:00Z',
  colorPrimario: '#1e3a8a',
};

const suscripcion: SuscripcionResumenDto = {
  negocioId: 'neg-1',
  negocioNombre: 'Barbería Luis',
  negocioSlug: 'barberia-luis',
  fechaVencimiento: '2026-11-08T00:00:00Z',
  estado: 'PorVencer',
  diasRestantes: 5,
  totalPagos: 2,
  ultimoPago: null,
  planNombre: 'Basico',
  precioBase: 249,
  maxEmpleadosBase: 2,
  empleadosExtra: 1,
  totalMensual: 299,
  precioEmpleadoExtra: 50,
  sector: 'belleza',
  esTester: false,
  suscripcionVigente: true,
  accesoPermanente: false,
  ingresoMensual: 299,
};

const planes = [
  { id: 'plan-basico', nombre: 'Basico', precioMensual: 249, maxEmpleados: 2, maxCitasMes: 300, habilitaModuloPagos: false },
  { id: 'plan-pro', nombre: 'Pro', precioMensual: 449, maxEmpleados: 4, maxCitasMes: 1000, habilitaModuloPagos: true },
];

function Ubicacion() {
  const { pathname, search } = useLocation();
  return <output data-testid="ubicacion">{pathname + search}</output>;
}

function renderFicha(ruta = '/admin/negocios/neg-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { qc, ...render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>
        <Routes>
          <Route path="/admin" element={<Ubicacion />} />
          <Route path="/admin/negocios/:id" element={<><NegocioDetalleAdminPage /><Ubicacion /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  ) };
}

async function abrirSeccion(user: ReturnType<typeof userEvent.setup>, nombre: string) {
  const tabs = await screen.findByRole('navigation', { name: 'Secciones del negocio' });
  await user.click(within(tabs).getByRole('button', { name: nombre }));
}

beforeEach(() => {
  toastMock.mockReset();
  vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio]);
  vi.mocked(adminModule.adminApi.obtenerSuscripciones).mockResolvedValue([suscripcion]);
  vi.mocked(adminModule.adminApi.obtenerPagos).mockResolvedValue([]);
  vi.mocked(adminModule.adminApi.obtenerPlanes).mockResolvedValue(planes);
  vi.mocked(adminModule.adminApi.obtenerCatalogoAuditoria).mockResolvedValue({
    grupos: [{ id: 'administracion', etiqueta: 'Acciones de administración' }],
    acciones: [{ accion: 'PlanCambiado', etiqueta: 'Plan cambiado', grupo: 'administracion' }],
  });
  vi.mocked(adminModule.adminApi.obtenerAuditLogs).mockReset().mockResolvedValue({ total: 0, pagina: 1, tamano: 15, datos: [] });
});

describe('Ficha del negocio — encabezado y secciones', () => {
  it('muestra el negocio, su estado, su plan y su suscripción, con las cinco secciones', async () => {
    renderFicha();

    expect(await screen.findByRole('heading', { level: 1, name: 'Barbería Luis' })).toBeInTheDocument();
    expect(screen.getByText('/b/barberia-luis')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getAllByText('Básico').length).toBeGreaterThan(0);
    expect(screen.getByText('Vence en 5 d')).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Secciones del negocio' });
    expect(within(tabs).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Resumen', 'Suscripción y pagos', 'Propietario', 'Configuración', 'Actividad',
    ]);
    expect(screen.getByRole('link', { name: 'Negocios' })).toHaveAttribute('href', '/admin');
    expect(document.title).toContain('Barbería Luis');
  });

  it('el Resumen trae el uso, los datos, los enlaces y lo que requiere atención con su acción', async () => {
    renderFicha();

    const uso = await screen.findByRole('region', { name: 'Uso este mes' });
    expect(uso).toHaveTextContent('42 / 100');
    const datos = screen.getByRole('region', { name: 'Datos del negocio' });
    expect(datos).toHaveTextContent('contacto@barberia.mx');
    expect(datos).toHaveTextContent('20 de octubre de 2026');
    const enlaces = screen.getByRole('region', { name: 'Enlaces' });
    expect(within(enlaces).getByRole('link', { name: /página de reservas/ })).toHaveAttribute('href', '/b/barberia-luis');

    const atencion = screen.getByRole('region', { name: 'Requiere atención' });
    expect(within(atencion).getByText('Por vencer')).toBeInTheDocument();
    expect(within(atencion).getByText('Correo sin verificar')).toBeInTheDocument();
    expect(within(atencion).getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument();
  });

  it('"Registrar pago" del aviso lleva a la sección de suscripción', async () => {
    const user = userEvent.setup();
    renderFicha();
    const atencion = await screen.findByRole('region', { name: 'Requiere atención' });
    await user.click(within(atencion).getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/admin/negocios/neg-1?seccion=suscripcion');
    expect(await screen.findByTestId('billing-summary')).toBeInTheDocument();
  });

  it('la sección se puede abrir por la URL', async () => {
    renderFicha('/admin/negocios/neg-1?seccion=propietario');
    expect(await screen.findByRole('region', { name: 'Propietario' })).toHaveTextContent('luis@barberia.mx');
  });

  it('si el negocio no existe lo dice y ofrece volver a la lista', async () => {
    renderFicha('/admin/negocios/no-existe');
    expect(await screen.findByText('No encontramos este negocio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todos los negocios' })).toHaveAttribute('href', '/admin');
  });

  it('si fallan las métricas, ErrorCarga con Reintentar', async () => {
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockRejectedValue(new Error('500'));
    renderFicha();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el negocio.');
  });

  it('si falla una recarga con datos en caché, la ficha y el modal abierto siguen en pie', async () => {
    const user = userEvent.setup();
    const { qc } = renderFicha('/admin/negocios/neg-1?seccion=configuracion');
    await user.click(await screen.findByRole('button', { name: 'Editar colores' }));
    expect(await screen.findByRole('dialog', { name: 'Colores del negocio' })).toBeInTheDocument();

    // Lo mismo que hace `invalidar()` tras cada acción, pero con la red caída.
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockRejectedValue(new Error('500'));
    await act(() => qc.invalidateQueries({ queryKey: ['admin-negocios-metricas'] }));

    expect(await screen.findByText(/No se pudieron actualizar los datos/)).toBeInTheDocument();
    expect(screen.queryByText('No se pudo cargar el negocio.')).not.toBeInTheDocument();
    // Con el modal abierto el fondo queda oculto a la accesibilidad, pero montado.
    expect(screen.getByRole('heading', { level: 1, name: 'Barbería Luis', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Colores del negocio' })).toBeInTheDocument();

    // Cerrado el modal, "Reintentar" del aviso vuelve a pedir las métricas; al
    // responder, el aviso se va.
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Colores del negocio' })).not.toBeInTheDocument());
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([negocio]);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByText(/No se pudieron actualizar los datos/)).not.toBeInTheDocument());
  });
});

describe('Ficha del negocio — suscripción y pagos', () => {
  it('muestra Cuenta y Pagos a la vez, sin pestañas dentro de la pestaña', async () => {
    const user = userEvent.setup();
    renderFicha();
    await abrirSeccion(user, 'Suscripción y pagos');

    expect(await screen.findByRole('region', { name: 'Cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pagos' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones de la suscripción' })).not.toBeInTheDocument();
    // El borrador de empleados extra arranca en el valor guardado, no en 0.
    expect(screen.getByRole('spinbutton', { name: 'Empleados extra' })).toHaveValue(1);
    expect(screen.queryByRole('button', { name: /^Guardar/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Sin pagos registrados')).toBeInTheDocument();
  });

  it('cambiar el plan pide la misma confirmación con el antes y el después', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.setPlan).mockResolvedValue(undefined as never);
    renderFicha('/admin/negocios/neg-1?seccion=suscripcion');

    await user.click(await screen.findByRole('button', { name: 'Pro' }));
    expect(adminModule.adminApi.setPlan).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('dialog', { name: '¿Cambiar Barbería Luis al plan Pro?' });
    expect(dialogo).toHaveTextContent('Básico → Pro');
    await user.click(within(dialogo).getByRole('button', { name: 'Cambiar plan' }));
    await waitFor(() => expect(adminModule.adminApi.setPlan).toHaveBeenCalledWith('neg-1', 'plan-pro'));
  });
});

describe('Ficha del negocio — propietario', () => {
  it('"Restablecer contraseña" abre el modal de siempre', async () => {
    const user = userEvent.setup();
    renderFicha('/admin/negocios/neg-1?seccion=propietario');
    await user.click(await screen.findByRole('button', { name: 'Restablecer contraseña' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Propietario' });
    expect(within(dialogo).getByText('luis@barberia.mx')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Restablecer contraseña' })).toBeDisabled();
  });

  it('"Confirmar correo" pide confirmación antes de marcarlo', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.confirmarEmail).mockResolvedValue(undefined as never);
    renderFicha('/admin/negocios/neg-1?seccion=propietario');
    await user.click(await screen.findByRole('button', { name: 'Confirmar correo' }));
    const dialogo = await screen.findByRole('dialog', { name: '¿Confirmar el correo del propietario?' });
    expect(adminModule.adminApi.confirmarEmail).not.toHaveBeenCalled();
    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar correo' }));
    await waitFor(() => expect(adminModule.adminApi.confirmarEmail).toHaveBeenCalledWith('neg-1'));
  });

  it('sin propietario, ofrece crearlo con el formulario de siempre', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      { ...negocio, propietarioEmail: undefined, propietarioNombre: undefined, emailConfirmado: null },
    ]);
    renderFicha('/admin/negocios/neg-1?seccion=propietario');
    expect(await screen.findByText('Sin propietario')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Crear propietario' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Propietario' });
    expect(within(dialogo).getByText('Contraseña inicial *')).toBeInTheDocument();
  });
});

describe('Ficha del negocio — configuración', () => {
  it('el módulo de pagos cambia al instante y el aviso ofrece "Deshacer"', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.toggleModuloPagos).mockResolvedValue(undefined);
    renderFicha('/admin/negocios/neg-1?seccion=configuracion');

    const interruptor = await screen.findByRole('switch', { name: 'Módulo pagos' });
    expect(interruptor).toHaveAccessibleDescription(/sección Pagos/);
    await user.click(interruptor);
    await waitFor(() => expect(adminModule.adminApi.toggleModuloPagos).toHaveBeenCalledWith('neg-1', true));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(
      'Módulo de pagos habilitado en Barbería Luis', 'exito', expect.objectContaining({ accion: expect.objectContaining({ etiqueta: 'Deshacer' }) }),
    ));
    expect(interruptor).toHaveAttribute('aria-checked', 'true');
  });

  it('el modo tester envía el valor absoluto', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.setTester).mockResolvedValue({ esTester: true });
    renderFicha('/admin/negocios/neg-1?seccion=configuracion');
    await user.click(await screen.findByRole('switch', { name: 'Tester' }));
    await waitFor(() => expect(adminModule.adminApi.setTester).toHaveBeenCalledWith('neg-1', true));
  });

  it('"Editar colores" abre el modal con el color guardado', async () => {
    const user = userEvent.setup();
    renderFicha('/admin/negocios/neg-1?seccion=configuracion');
    await user.click(await screen.findByRole('button', { name: 'Editar colores' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Colores del negocio' });
    expect(within(dialogo).getByRole('textbox', { name: 'Color primario en hexadecimal' })).toHaveValue('#1e3a8a');
  });

  it('desactivar pide la misma confirmación y no desactiva con un clic', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.desactivar).mockResolvedValue(undefined as never);
    renderFicha('/admin/negocios/neg-1?seccion=configuracion');
    const zona = await screen.findByRole('region', { name: 'Estado y eliminación' });
    await user.click(within(zona).getByRole('button', { name: 'Desactivar' }));
    expect(adminModule.adminApi.desactivar).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole('dialog', { name: '¿Desactivar Barbería Luis?' });
    await user.click(within(dialogo).getByRole('button', { name: 'Desactivar negocio' }));
    await waitFor(() => expect(adminModule.adminApi.desactivar).toHaveBeenCalledWith('neg-1'));
  });

  it('eliminar sigue pidiendo el nombre en dos pasos y, al terminar, vuelve a la lista', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.eliminarNegocio).mockResolvedValue(undefined);
    renderFicha('/admin/negocios/neg-1?seccion=configuracion');
    const zona = await screen.findByRole('region', { name: 'Estado y eliminación' });
    await user.click(within(zona).getByRole('button', { name: 'Eliminar negocio' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Eliminar negocio' });
    expect(within(dialogo).getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await user.type(within(dialogo).getByPlaceholderText('Barbería Luis'), 'Barbería Luis');
    await user.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar definitivamente' }));

    await waitFor(() => expect(adminModule.adminApi.eliminarNegocio).toHaveBeenCalledWith('neg-1'));
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent(/^\/admin$/));
  });
});

describe('Ficha del negocio — actividad', () => {
  it('pide al registro de auditoría solo las entradas de este negocio y las muestra con su etiqueta', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerAuditLogs).mockResolvedValue({
      total: 1, pagina: 1, tamano: 15,
      datos: [{
        id: 'a1', usuarioId: 'u1', usuarioEmail: 'admin@appointva.com', accion: 'PlanCambiado',
        entidad: 'Negocio', entidadId: 'neg-1', detalles: 'Basico → Pro', ipAddress: '::1',
        fechaEn: '2026-11-02T18:30:00Z', negocioNombre: 'Barbería Luis',
      }],
    });
    renderFicha();
    await abrirSeccion(user, 'Actividad');

    const lista = await screen.findByRole('list', { name: 'Actividad del negocio' });
    expect(adminModule.adminApi.obtenerAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ negocioId: 'neg-1', pagina: 1 }));
    expect(within(lista).getByText('Plan cambiado')).toBeInTheDocument();
    expect(within(lista).getByText('Basico → Pro')).toBeInTheDocument();
    expect(within(lista).getByText('Por admin@appointva.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el registro completo' })).toHaveAttribute('href', '/admin/audit');
  });

  it('sin actividad lo dice con EmptyState', async () => {
    renderFicha('/admin/negocios/neg-1?seccion=actividad');
    expect(await screen.findByText('Sin actividad registrada')).toBeInTheDocument();
  });

  it('si falla, ErrorCarga con Reintentar', async () => {
    vi.mocked(adminModule.adminApi.obtenerAuditLogs).mockRejectedValue(new Error('500'));
    renderFicha('/admin/negocios/neg-1?seccion=actividad');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar la actividad del negocio.');
  });
});

describe('Ficha del negocio — acciones del encabezado', () => {
  it('el "⋯" tiene las mismas acciones secundarias que la tarjeta', async () => {
    const user = userEvent.setup();
    renderFicha();
    await user.click(await screen.findByRole('button', { name: 'Más acciones de Barbería Luis' }));
    const menu = await screen.findByRole('dialog', { name: 'Más acciones de Barbería Luis' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent?.trim()).filter(Boolean))
      .toEqual(['Confirmar correo', 'Colores', 'Ver página de reservas', 'Eliminar negocio']);
  });

  it('un negocio pendiente se activa desde el encabezado', async () => {
    const user = userEvent.setup();
    vi.mocked(adminModule.adminApi.obtenerMetricas).mockResolvedValue([
      { ...negocio, activo: 0, planId: undefined, planNombre: undefined, planSolicitado: 'pro' },
    ]);
    vi.mocked(adminModule.adminApi.activar).mockResolvedValue(undefined as never);
    renderFicha();
    expect(await screen.findByText('Pendiente de activación')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Datos del negocio' })).toHaveTextContent('Plan elegido al registrarsePro');
    const botones = screen.getAllByRole('button', { name: 'Activar' });
    await user.click(botones[0]);
    await waitFor(() => expect(adminModule.adminApi.activar).toHaveBeenCalledWith('neg-1'));
  });
});
