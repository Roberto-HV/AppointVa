import { test, expect, type Page } from '@playwright/test';

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

const SERVICE_ID = 'servicio-1';
const EMPLOYEE_ID = 'empleado-1';
const CONFIRM_CODE = 'TEST123';

const NEGOCIO_MOCK = {
  id: 'negocio-1',
  nombre: 'Salón Test',
  slug: 'salon-test',
  descripcion: 'Un salón de prueba',
  colorPrimario: '#334155',
  autoConfirmar: true,
  listaEsperaActiva: false,
  horasCancelacion: 0,
  promedioResenas: 0,
  totalResenas: 0,
  telefonoWhatsApp: null,
  portadaUrl: null,
  logoUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  servicios: [
    {
      id: SERVICE_ID,
      nombre: 'Corte de cabello',
      duracionMinutos: 30,
      precio: 250,
      categoriaNombre: 'Servicios',
      orden: 1,
      imagenUrl: null,
      descripcion: null,
    },
  ],
  empleados: [
    {
      id: EMPLOYEE_ID,
      nombre: 'María',
      servicioIds: [SERVICE_ID],
      promedioResenas: 0,
      totalResenas: 0,
      fotoUrl: null,
      biografia: null,
    },
  ],
  galeria: [],
  resenas: [],
};

function buildSlotsMock(fecha: string) {
  return [
    { inicio: `${fecha}T09:00:00`, horaTexto: '09:00', empleadoId: EMPLOYEE_ID, empleadoNombre: 'María' },
    { inicio: `${fecha}T09:30:00`, horaTexto: '09:30', empleadoId: EMPLOYEE_ID, empleadoNombre: 'María' },
    { inicio: `${fecha}T10:00:00`, horaTexto: '10:00', empleadoId: EMPLOYEE_ID, empleadoNombre: 'María' },
  ];
}

function buildCitaDetalleMock(fecha: string) {
  return {
    id: 'cita-1',
    codigoConfirmacion: CONFIRM_CODE,
    nombreNegocio: 'Salón Test',
    nombreServicio: 'Corte de cabello',
    nombreEmpleado: 'María',
    nombreCliente: 'Juan Pérez',
    inicioEn: `${fecha}T09:00:00`,
    estadoTexto: 'Confirmada',
    precio: 250,
    negocioSlug: 'salon-test',
    colorPrimario: '#334155',
    emailCliente: 'juan@test.com',
    servicioId: SERVICE_ID,
    empleadoId: EMPLOYEE_ID,
    horasCancelacion: 0,
    requiereAnticipo: false,
    icalUrl: null,
    googleCalUrl: null,
    webcalUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    tiktokUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

async function setupRoutes(page: Page, fecha: string) {
  // Business info (services + employees come embedded)
  // Actual URL: GET /api/publico/negocios/salon-test
  await page.route('**/api/publico/negocios/salon-test', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(NEGOCIO_MOCK) })
  );

  // Intake campos — return empty so no intake sub-step is shown
  // Actual URL: GET /api/publico/intake/salon-test
  await page.route(/\/api\/publico\/intake/, (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' })
  );

  // Availability slots
  // Actual URL: GET /api/publico/disponibilidad?servicioId=...&fecha=...&empleadoId=...
  await page.route(/\/api\/publico\/disponibilidad/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildSlotsMock(fecha)) })
  );

  // POST /api/publico/citas  →  create appointment
  // GET  /api/publico/citas/TEST123  →  confirmation page fetch
  await page.route(/\/api\/publico\/citas/, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'POST') {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'cita-1', codigoConfirmacion: CONFIRM_CODE, negocioSlug: 'salon-test' }),
      });
    }

    if (url.includes(`/${CONFIRM_CODE}`)) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(buildCitaDetalleMock(fecha)),
      });
    }

    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Booking flow', () => {
  test('golden path', async ({ page }) => {
    const fecha = tomorrowISO(); // e.g. "2026-07-25"

    await setupRoutes(page, fecha);

    // ── Step 1: Service selection ──────────────────────────────────────────
    await page.goto('/b/salon-test');

    // Wait for business name (negocio loaded)
    await expect(page.getByText('Salón Test').first()).toBeVisible({ timeout: 10_000 });

    // Click the service card
    await page.getByText('Corte de cabello').click();

    // Advance to step 2
    await page.getByRole('button', { name: 'Continuar' }).click();

    // ── Step 2: Employee selection ─────────────────────────────────────────
    await expect(page.getByText('¿Con quién?')).toBeVisible({ timeout: 5_000 });

    // Click "María" (the named professional card)
    await page.getByText('María').click();

    // Advance to step 3
    await page.getByRole('button', { name: 'Continuar' }).click();

    // ── Step 3: Date & time ────────────────────────────────────────────────
    await expect(page.getByText('Elige fecha y hora')).toBeVisible({ timeout: 5_000 });

    // If today is Sunday (dow=0), tomorrow is in the next week — navigate forward
    if (new Date().getDay() === 0) {
      await page.getByLabel('Semana siguiente').click();
    }

    // Click tomorrow's date. The weekly calendar shows 7 buttons (Mon–Sun).
    // Each button contains a short day name + the numeric date.
    const tomorrowDate = new Date(fecha + 'T12:00:00');
    const tomorrowDay = String(tomorrowDate.getDate()); // e.g. "25"

    // Scope to the 7-column calendar grid to avoid collisions with prices/times
    const calendarGrid = page.locator('.grid-cols-7');
    await calendarGrid.locator('button').filter({ hasText: tomorrowDay }).click();

    // Wait for slots to appear and select 09:00
    const slot0900 = page.getByRole('button', { name: '09:00' });
    await expect(slot0900).toBeVisible({ timeout: 8_000 });
    await slot0900.click();

    // Advance to step 4
    await page.getByRole('button', { name: 'Continuar' }).click();

    // ── Step 4a: Choose client mode ────────────────────────────────────────
    await expect(page.getByText('¿Ya has reservado antes?')).toBeVisible({ timeout: 5_000 });

    // Pick "guest" flow — fills data manually
    await page.getByText('Continuar como invitado').click();

    // ── Step 4b: Contact form ──────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible({ timeout: 5_000 });

    await page.getByPlaceholder('Tu nombre completo').fill('Juan Pérez');
    await page.getByPlaceholder('55 1234 5678').fill('5511223344');
    await page.getByPlaceholder('correo@ejemplo.com').fill('juan@test.com');

    // Submit
    await page.getByRole('button', { name: 'Confirmar cita' }).click();

    // ── Confirmation page ──────────────────────────────────────────────────
    await page.waitForURL(`**/confirmacion/${CONFIRM_CODE}`, { timeout: 10_000 });

    // The confirmation code is rendered in a monospace span
    await expect(page.getByText(CONFIRM_CODE)).toBeVisible({ timeout: 10_000 });
  });
});
