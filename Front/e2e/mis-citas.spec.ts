import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

// Upcoming: estado 2 (Confirmada) + future date → ends up in "Próximas"
// Past:     estado 3 (Completada) + past date  → ends up in "Historial"
const FUTURE_ISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_ISO   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const MIS_CITAS_MOCK = [
  {
    id: 'cita-1',
    codigoConfirmacion: 'PROX001',
    nombreNegocio: 'Salón Test',
    negocioSlug: 'salon-test',
    nombreServicio: 'Corte de cabello',
    nombreEmpleado: 'María',
    servicioId: 'servicio-1',
    empleadoId: 'empleado-1',
    inicioEn: FUTURE_ISO,
    finEn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    precio: 250,
    estado: 2,
    estadoTexto: 'Confirmada',
  },
  {
    id: 'cita-2',
    codigoConfirmacion: 'HIST001',
    nombreNegocio: 'Salón Test',
    negocioSlug: 'salon-test',
    nombreServicio: 'Tinte',
    nombreEmpleado: 'Laura',
    servicioId: 'servicio-2',
    empleadoId: 'empleado-1',
    inicioEn: PAST_ISO,
    finEn: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 120 * 60 * 1000).toISOString(),
    precio: 500,
    estado: 3,
    estadoTexto: 'Completada',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Mis Citas flow', () => {
  test('golden path — login and see upcoming + past appointments', async ({ page }) => {
    // Register route mock before navigating so no real API call escapes.
    // Actual URL: GET /api/publico/mis-citas?slug=...&email=...&telefono=...&pagina=...&tamano=...
    await page.route('**/api/publico/mis-citas**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'x-total-count': '2' },
        body: JSON.stringify(MIS_CITAS_MOCK),
      })
    );

    // 1. Navigate to the mis-citas page
    await page.goto('/b/salon-test/mis-citas');

    // 2. Verify the login form is shown (email + phone inputs)
    await expect(page.getByPlaceholder('tu@correo.com')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('10 dígitos')).toBeVisible();

    // 3–4. Fill credentials
    await page.getByPlaceholder('tu@correo.com').fill('cliente@test.com');
    await page.getByPlaceholder('10 dígitos').fill('5511223344');

    // 5. Submit — this sets `buscado` state and triggers the API call
    await page.getByRole('button', { name: 'Ver mis citas' }).click();

    // 6. Wait for the appointment list to render
    await expect(page.getByText('Corte de cabello').first()).toBeVisible({ timeout: 10_000 });

    // 7–8. Assert both section headings are visible
    // Note: CSS `uppercase` class doesn't affect text-node content; we match the source text.
    await expect(page.getByText('Próximas').first()).toBeVisible();
    await expect(page.getByText('Historial').first()).toBeVisible();

    // 9–10. Assert both appointment service names are visible
    await expect(page.getByText('Corte de cabello').first()).toBeVisible();
    await expect(page.getByText('Tinte').first()).toBeVisible();
  });
});
