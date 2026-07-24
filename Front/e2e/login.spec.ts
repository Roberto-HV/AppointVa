import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const LOGIN_RESPONSE = {
  token: 'test-jwt-token',
  refreshToken: 'test-refresh-token',
  requiere2FA: false,
  usuario: {
    id: 'user-1',
    email: 'admin@salon.com',
    nombreCompleto: 'Admin Salon',
    rol: 'Propietario',
    negocioId: 'negocio-1',
    fotoUrl: null,
  },
};

const PERFIL_NEGOCIO = {
  id: 'negocio-1',
  nombre: 'Salón Test',
  slug: 'salon-test',
  activo: true,
  colorPrimario: '#334155',
  descripcion: null,
  logoUrl: null,
  portadaUrl: null,
  planNombre: 'Básico',
};

const RESUMEN_DASHBOARD = {
  citasHoy: 0,
  citasSemana: 0,
  citasMes: 0,
  ingresosHoy: 0,
  ingresosSemana: 0,
  ingresosMes: 0,
  proximasCitas: [],
  topServicios: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True only when the path exactly equals the API route (no /src/ prefix). */
const isApiPath = (url: URL, pathname: string) => url.pathname === pathname;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Login → Dashboard', () => {
  test('logs in with valid credentials and lands on dashboard', async ({ page }) => {
    // Use URL-predicate functions (not globs) so Vite's own JS module requests
    // (e.g. /src/api/citas.ts) are never accidentally intercepted.

    // -- Mock: POST /api/auth/login ------------------------------------------
    await page.route(
      (url) => isApiPath(url, '/api/auth/login'),
      (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(LOGIN_RESPONSE) })
    );

    // -- Mock: GET /api/negocios/perfil/horarios (onboarding wizard) ----------
    await page.route(
      (url) => isApiPath(url, '/api/negocios/perfil/horarios'),
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' })
    );

    // -- Mock: GET /api/negocios/perfil (DashboardLayout sidebar + InicioPage) -
    await page.route(
      (url) => isApiPath(url, '/api/negocios/perfil'),
      (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(PERFIL_NEGOCIO) })
    );

    // -- Mock: GET /api/dashboard/resumen ------------------------------------
    await page.route(
      (url) => isApiPath(url, '/api/dashboard/resumen'),
      (route) =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(RESUMEN_DASHBOARD) })
    );

    // -- Mock: GET /api/dashboard/tendencia ----------------------------------
    await page.route(
      (url) => isApiPath(url, '/api/dashboard/tendencia'),
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' })
    );

    // -- Mock: GET /api/empleados --------------------------------------------
    await page.route(
      (url) => url.pathname.startsWith('/api/empleados'),
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' })
    );

    // -- Mock: GET /api/citas (badge count in DashboardLayout header) ---------
    await page.route(
      (url) => isApiPath(url, '/api/citas'),
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' })
    );

    // ── Step 1: Navigate to login page ──────────────────────────────────────
    await page.goto('/login');
    // RutaPublica renders null during zustand localStorage hydration, then
    // reveals the form. waitFor polls until visible (typically < 100 ms).
    await page.getByPlaceholder('correo@ejemplo.com').waitFor({ state: 'visible', timeout: 10_000 });

    // ── Step 2: Fill credentials ────────────────────────────────────────────
    await page.getByPlaceholder('correo@ejemplo.com').fill('admin@salon.com');
    await page.getByPlaceholder('••••••••').fill('Password1');

    // ── Step 3: Submit ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Entrar' }).click();

    // ── Step 4: Wait for navigation to dashboard ────────────────────────────
    await page.waitForURL('**/dashboard**', { timeout: 10_000 });

    // ── Step 5: Assert dashboard heading is visible ─────────────────────────
    // InicioPage renders <h1>Hola, {firstName}</h1> from zustand state —
    // no API response needed. firstName = 'Admin' (first word of nombreCompleto).
    await expect(page.getByRole('heading', { name: 'Hola, Admin' })).toBeVisible({ timeout: 5_000 });
  });
});
