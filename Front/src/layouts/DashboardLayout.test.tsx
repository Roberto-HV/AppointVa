import { describe, it, expect } from 'vitest';
import { getNav } from './DashboardLayout';

describe('getNav', () => {
  it('includes Pagos and Galería for belleza', () => {
    const nav = getNav('belleza');
    expect(nav.some(n => n.to === '/dashboard/pagos')).toBe(true);
    expect(nav.some(n => n.to === '/dashboard/galeria')).toBe(true);
  });

  it('excludes Pagos, Galería, and Descuentos for salud', () => {
    const nav = getNav('salud');
    expect(nav.some(n => n.to === '/dashboard/pagos')).toBe(false);
    expect(nav.some(n => n.to === '/dashboard/galeria')).toBe(false);
    expect(nav.some(n => n.to === '/dashboard/descuentos')).toBe(false);
  });

  it('renames Empleados to Profesionales for salud', () => {
    const emp = getNav('salud').find(n => n.to === '/dashboard/empleados');
    expect(emp?.label).toBe('Profesionales');
  });

  it('renames Servicios to Tipos de consulta for salud', () => {
    const svc = getNav('salud').find(n => n.to === '/dashboard/servicios');
    expect(svc?.label).toBe('Tipos de consulta');
  });

  it('renames Clientes to Pacientes for salud', () => {
    const cli = getNav('salud').find(n => n.to === '/dashboard/clientes');
    expect(cli?.label).toBe('Pacientes');
  });

  it('keeps original labels for belleza', () => {
    const nav = getNav('belleza');
    expect(nav.find(n => n.to === '/dashboard/empleados')?.label).toBe('Empleados');
    expect(nav.find(n => n.to === '/dashboard/servicios')?.label).toBe('Servicios');
    expect(nav.find(n => n.to === '/dashboard/clientes')?.label).toBe('Clientes');
  });
});
