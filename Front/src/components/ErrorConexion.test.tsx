import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ErrorConexion from './ErrorConexion';

describe('ErrorConexion', () => {
  it('muestra el título y mensaje por defecto', () => {
    render(<ErrorConexion refetch={vi.fn()} />);
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText(/No se pudo cargar la información/)).toBeInTheDocument();
  });

  it('muestra un mensaje personalizado cuando se pasa el prop', () => {
    render(<ErrorConexion refetch={vi.fn()} mensaje="Error al cargar clientes" />);
    expect(screen.getByText('Error al cargar clientes')).toBeInTheDocument();
  });

  it('llama a refetch al hacer clic en Reintentar', async () => {
    const refetch = vi.fn();
    render(<ErrorConexion refetch={refetch} />);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
