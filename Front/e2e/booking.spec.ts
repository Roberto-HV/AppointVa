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
      descripcion: 'Corte moderno o clásico con lavado y peinado incluidos.',
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

// Seven days starting at `desde`, the shape GET /publico/disponibilidad/semana returns.
// Only `fechaConHorarios` carries slots: the rest answer "sin-horarios", so the calendar
// has exactly one bookable day and the test cannot pass by landing on the wrong one.
function buildSemanaMock(desde: string, fechaConHorarios: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${desde}T12:00:00`);
    d.setDate(d.getDate() + i);
    const iso = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
    const abierto = iso === fechaConHorarios;
    return {
      fecha: iso,
      estado: abierto ? 'con-horarios' : 'sin-horarios',
      horarios: abierto ? buildSlotsMock(iso) : [],
    };
  });
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
    googleCalUrl: null,
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

  // Weekly availability — GET /api/publico/disponibilidad/semana?servicioId=...&desde=...&dias=7
  // This answers a DIFFERENT shape from the per-day endpoint: one object per day, with
  // that day's slots nested inside. It must be registered as its own route, because the
  // per-day pattern below used to match this URL too and answered it with a flat slot
  // array — the calendar then read slot objects as days, found no `fecha` on any of them
  // and marked the whole week empty.
  await page.route(/\/api\/publico\/disponibilidad\/semana/, (route) => {
    const desde = new URL(route.request().url()).searchParams.get('desde');
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(buildSemanaMock(desde ?? fecha, fecha)),
    });
  });

  // Per-day availability — GET /api/publico/disponibilidad?servicioId=...&fecha=...&empleadoId=...
  // The literal '?' belongs to the pattern: without it this also matches /semana.
  await page.route(/\/api\/publico\/disponibilidad\?/, (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(buildSlotsMock(fecha)) })
  );

  // GET /api/publico/cliente?slug=...&telefono=... — the phone field looks the client up.
  // 404 is the real answer for a number the business has never seen, which is this test's
  // case; without it the request would fall through to a backend that is not running.
  await page.route(/\/api\/publico\/cliente/, (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
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

    // ── Step 4: Contact form ───────────────────────────────────────────────
    // The booking used to ask "¿Ya has reservado antes?" first and branch into a
    // guest flow. It no longer does: the phone field itself looks the client up,
    // so step 4 goes straight to the form.
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

  // Regression guard for the dead hit area in FilaSeleccion. The selection button
  // stretches over the whole card with an `::after` measured against the card, but
  // the global `button:not([disabled]):active { transform: scale(.97) }` in
  // index.css turned the button into a containing block while it was pressed, so
  // the `::after` collapsed from the card to the button's own box mid-click: the
  // mousedown landed on the button, the mouseup no longer did, and the resulting
  // click fired on the card instead. Only the title line selected, so the owner
  // had to click twice. The golden path above never caught it because it clicks
  // the title text, which always worked.
  //
  // This has to run in a real browser: the bug lives between mousedown and mouseup
  // and depends on layout and hit testing, neither of which jsdom has, so a unit
  // test could not tell the two cases apart. Every assertion below clicks by
  // COORDINATE and never by role or text: resolving the button by name would make
  // Playwright click its centre, which is exactly the spot that always worked.
  test('the whole service card selects, not only its title', async ({ page }) => {
    await setupRoutes(page, tomorrowISO());
    await page.goto('/b/salon-test');

    const boton = page.getByRole('button', { name: 'Corte de cabello' });
    await expect(boton).toBeVisible({ timeout: 10_000 });
    await expect(boton).toHaveAttribute('aria-pressed', 'false');

    // The visible card is the INNERMOST div.relative holding the button: `has:`
    // also matches the wrappers above it, so `.last()` (last in document order)
    // is the one that actually wraps the row.
    const tarjeta = page.locator('div.relative', { has: boton }).last();
    const caja = await tarjeta.boundingBox();
    if (!caja) throw new Error('could not measure the service card');

    // Deliberately away from the title: low and to the right, over the
    // description and the price — the area that used to be dead.
    await page.mouse.click(
      Math.round(caja.x + caja.width * 0.75),
      Math.round(caja.y + caja.height * 0.75),
    );

    await expect(boton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  test('the whole employee card selects, not only its title', async ({ page }) => {
    await setupRoutes(page, tomorrowISO());
    await page.goto('/b/salon-test');

    await page.getByRole('button', { name: 'Corte de cabello' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();

    const boton = page.getByRole('button', { name: 'María' });
    await expect(boton).toBeVisible({ timeout: 10_000 });
    await expect(boton).toHaveAttribute('aria-pressed', 'false');

    const tarjeta = page.locator('div.relative', { has: boton }).last();
    const caja = await tarjeta.boundingBox();
    if (!caja) throw new Error('could not measure the employee card');

    // Same idea as above: away from the title, over the area that used to be dead.
    await page.mouse.click(
      Math.round(caja.x + caja.width * 0.75),
      Math.round(caja.y + caja.height * 0.75),
    );

    await expect(boton).toHaveAttribute('aria-pressed', 'true');
  });
});
