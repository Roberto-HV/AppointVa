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
// Mock data
// ---------------------------------------------------------------------------

const CODIGO = 'REAGENDA01';
const SERVICIO_ID = 'serv-1';
const EMPLEADO_ID = 'emp-1';

function buildCitaMock(fecha: string) {
  return {
    id: 'cita-reagendar-1',
    codigoConfirmacion: CODIGO,
    nombreNegocio: 'Salón Test',
    negocioSlug: 'salon-test',
    nombreServicio: 'Corte de cabello',
    nombreEmpleado: 'María',
    servicioId: SERVICIO_ID,
    empleadoId: EMPLEADO_ID,
    inicioEn: `${fecha}T09:00:00`,
    finEn: `${fecha}T09:30:00`,
    precio: 250,
    estado: 1,
    estadoTexto: 'Pendiente',
  };
}

function buildSlotsMock(fecha: string) {
  return [
    { inicio: `${fecha}T10:00:00`, horaTexto: '10:00', empleadoId: EMPLEADO_ID, empleadoNombre: 'María' },
    { inicio: `${fecha}T10:30:00`, horaTexto: '10:30', empleadoId: EMPLEADO_ID, empleadoNombre: 'María' },
    { inicio: `${fecha}T11:00:00`, horaTexto: '11:00', empleadoId: EMPLEADO_ID, empleadoNombre: 'María' },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Reagendar flow', () => {
  test('smoke — select new slot and confirm reschedule', async ({ page }) => {
    const fecha = tomorrowISO();

    // ── 1. Register mocks before any navigation ────────────────────────────

    // GET /api/publico/mis-citas → one upcoming Pendiente appointment
    await page.route('**/api/publico/mis-citas**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'x-total-count': '1' },
        body: JSON.stringify([buildCitaMock(fecha)]),
      })
    );

    // GET /api/publico/disponibilidad → 3 morning slots for tomorrow
    await page.route(/\/api\/publico\/disponibilidad/, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildSlotsMock(fecha)),
      })
    );

    // PATCH /api/publico/citas/{codigo}/reagendar → success
    await page.route(/\/api\/publico\/citas\/.*\/reagendar/, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ mensaje: 'Cita reagendada correctamente' }),
      })
    );

    // ── 2. Pre-seed session so the login form is skipped ───────────────────
    await page.addInitScript(() => {
      localStorage.setItem(
        'mcs_session',
        JSON.stringify({ email: 'cliente@test.com', telefono: '5511223344' })
      );
    });

    // ── 3. Navigate ────────────────────────────────────────────────────────
    await page.goto('/b/salon-test/mis-citas');

    // ── 4. Wait for the appointment card ──────────────────────────────────
    await expect(page.getByText('Corte de cabello').first()).toBeVisible({ timeout: 10_000 });

    // ── 5. Click "Reagendar" on the appointment card ───────────────────────
    await page.getByRole('button', { name: 'Reagendar' }).click();

    // ── 6. Wait for the modal to open ─────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Reagendar cita' })).toBeVisible({
      timeout: 5_000,
    });

    // ── 7. Select tomorrow in the weekly calendar grid ─────────────────────
    // If today is Sunday the weekly grid starts on last Monday and tomorrow
    // (Monday of next week) is outside the current view — navigate forward.
    if (new Date().getDay() === 0) {
      await page.getByLabel('Semana siguiente').click();
    }

    const tomorrowDate = new Date(`${fecha}T12:00:00`);
    const tomorrowDay = String(tomorrowDate.getDate()); // e.g. "25"

    // Scope to the 7-column grid inside the modal to avoid collision with
    // any other numeric text on the page.
    const calendarGrid = page.locator('.grid-cols-7');
    await calendarGrid.locator('button').filter({ hasText: tomorrowDay }).click();

    // ── 8. Click the 10:00 slot ────────────────────────────────────────────
    const slot1000 = page.getByRole('button', { name: '10:00' });
    await expect(slot1000).toBeVisible({ timeout: 8_000 });
    await slot1000.click();

    // ── 9. Confirm the new slot ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Confirmar nuevo horario' }).click();

    // ── 10. Assert success message ─────────────────────────────────────────
    await expect(page.getByText('¡Cita reagendada exitosamente!')).toBeVisible({
      timeout: 8_000,
    });
  });
});
