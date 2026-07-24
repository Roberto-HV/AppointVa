import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Cancelar cita flow', () => {
  test('golden path', async ({ page }) => {
    const fecha = tomorrowISO();
    const CODIGO = 'TEST123';

    const citaMock = {
      codigoConfirmacion: CODIGO,
      nombreNegocio: 'Salón Test',
      nombreServicio: 'Corte de cabello',
      nombreEmpleado: 'María',
      nombreCliente: 'Juan Pérez',
      inicioEn: `${fecha}T09:00:00`,
      precio: 250,
      estado: 1,
      estadoTexto: 'Pendiente',
      horasCancelacion: 0,
    };

    // Mock GET /api/publico/citas/TEST123  →  appointment details
    // Mock DELETE /api/publico/citas/TEST123?email=...  →  cancellation
    // Both share the same URL pattern so we dispatch by method inside one handler.
    await page.route(/\/api\/publico\/citas\/TEST123/, (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(citaMock),
        });
      }

      if (method === 'DELETE') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ mensaje: 'Cita cancelada exitosamente' }),
        });
      }

      return route.continue();
    });

    // ── Step 1: Navigate to cancel page ───────────────────────────────────
    await page.goto(`/cancelar/${CODIGO}`);

    // ── Step 2: Assert appointment details loaded ──────────────────────────
    await expect(page.getByText('Corte de cabello')).toBeVisible({ timeout: 10_000 });

    // ── Step 3: Fill email to confirm identity ─────────────────────────────
    await page.getByPlaceholder('tucorreo@ejemplo.com').fill('cliente@test.com');

    // ── Step 4: Click primary cancel button ───────────────────────────────
    await page.getByRole('button', { name: 'Cancelar mi cita' }).click();

    // ── Step 5: Confirmation screen must appear ────────────────────────────
    await expect(page.getByRole('button', { name: 'Sí, cancelar' })).toBeVisible({ timeout: 5_000 });

    // ── Step 6: Confirm cancellation ──────────────────────────────────────
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();

    // ── Step 7: Success state ──────────────────────────────────────────────
    await expect(page.getByText('Cita cancelada')).toBeVisible({ timeout: 10_000 });
  });
});
