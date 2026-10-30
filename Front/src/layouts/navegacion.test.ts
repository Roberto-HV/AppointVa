import { describe, it, expect } from 'vitest';
import { getNavGrupos } from './navegacion';

const rutas = (sector: string, listaEspera = false) =>
  getNavGrupos(sector, listaEspera).flatMap(g => g.items.map(i => i.to));
const item = (sector: string, to: string) =>
  getNavGrupos(sector).flatMap(g => g.items).find(i => i.to === to);

describe('getNavGrupos', () => {
  it('groups the owner menu into labeled sections (I5)', () => {
    const grupos = getNavGrupos('belleza');
    expect(grupos.map(g => g.titulo)).toEqual(['Agenda', 'Clientes y equipo', 'Catálogo', 'Negocio']);
    expect(grupos[0].items.map(i => i.label)).toEqual(['Inicio', 'Citas', 'Pagos', 'Recepción']);
    expect(grupos[1].items.map(i => i.label)).toEqual(['Clientes', 'Reseñas', 'Empleados']);
    expect(grupos[2].items.map(i => i.label)).toEqual(['Servicios', 'Descuentos', 'Cuestionario']);
    expect(grupos[3].items.map(i => i.label)).toEqual(['Mi negocio', 'Galería', 'Reportes']);
  });

  it('keeps every route and drops Seguridad from the main menu', () => {
    expect(rutas('belleza')).toEqual(expect.arrayContaining([
      '/dashboard', '/dashboard/citas', '/dashboard/pagos', '/dashboard/clientes',
      '/dashboard/empleados', '/dashboard/servicios', '/dashboard/descuentos',
      '/dashboard/resenas', '/dashboard/reportes', '/dashboard/perfil',
      '/dashboard/galeria', '/dashboard/intake',
    ]));
    expect(rutas('belleza')).not.toContain('/dashboard/seguridad');
  });

  it('shows Lista de espera only when the business has it enabled', () => {
    expect(rutas('belleza')).not.toContain('/dashboard/espera');
    expect(rutas('belleza', true)).toContain('/dashboard/espera');
    expect(rutas('salud', true)).not.toContain('/dashboard/espera');
  });

  it('Recepción is an action that confirms, not a plain link', () => {
    expect(item('belleza', '/dashboard/kiosk')?.recepcion).toBe(true);
  });

  it('includes Pagos and Galería for belleza', () => {
    expect(rutas('belleza')).toContain('/dashboard/pagos');
    expect(rutas('belleza')).toContain('/dashboard/galeria');
  });

  it('excludes Pagos, Galería, and Descuentos for salud', () => {
    const nav = rutas('salud');
    expect(nav).not.toContain('/dashboard/pagos');
    expect(nav).not.toContain('/dashboard/galeria');
    expect(nav).not.toContain('/dashboard/descuentos');
  });

  it('uses the sector terms for salud', () => {
    expect(item('salud', '/dashboard/empleados')?.label).toBe('Profesionales');
    expect(item('salud', '/dashboard/servicios')?.label).toBe('Tipos de consulta');
    expect(item('salud', '/dashboard/clientes')?.label).toBe('Pacientes');
    expect(getNavGrupos('salud')[1].titulo).toBe('Pacientes y equipo');
  });

  it('keeps original labels for belleza', () => {
    expect(item('belleza', '/dashboard/empleados')?.label).toBe('Empleados');
    expect(item('belleza', '/dashboard/servicios')?.label).toBe('Servicios');
    expect(item('belleza', '/dashboard/clientes')?.label).toBe('Clientes');
  });
});
