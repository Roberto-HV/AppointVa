import { vi, describe, it, expect, beforeEach } from 'vitest';
import { adminApi } from './admin';
import * as axiosModule from './axios';

vi.mock('./axios', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('adminApi.setEmpleadosExtra', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PATCH /admin/negocios/{id}/empleados-extra with correct body', async () => {
    const mockApi = vi.mocked(axiosModule.api);
    mockApi.patch.mockResolvedValueOnce(undefined);

    await adminApi.setEmpleadosExtra('negocio-1', 3);

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/admin/negocios/negocio-1/empleados-extra',
      { empleadosExtra: 3 }
    );
  });

  it('rejects when api.patch fails', async () => {
    const mockApi = vi.mocked(axiosModule.api);
    const error = new Error('Network error');
    mockApi.patch.mockRejectedValueOnce(error);

    await expect(adminApi.setEmpleadosExtra('negocio-1', 3)).rejects.toThrow(
      'Network error'
    );
  });
});

describe('adminApi.setSector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PATCH /admin/negocios/{id}/sector with the given sector', async () => {
    const mockApi = vi.mocked(axiosModule.api);
    mockApi.patch.mockResolvedValueOnce(undefined);

    await adminApi.setSector('abc-123', 'salud');

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/admin/negocios/abc-123/sector',
      { sector: 'salud' }
    );
  });

  it('rejects when api.patch fails', async () => {
    const mockApi = vi.mocked(axiosModule.api);
    const error = new Error('Network error');
    mockApi.patch.mockRejectedValueOnce(error);

    await expect(adminApi.setSector('abc-123', 'salud')).rejects.toThrow(
      'Network error'
    );
  });
});
