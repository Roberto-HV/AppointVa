import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Regresión: elegir un fondo de portada no debe mover la página
//
// El dashboard vive dentro de un armazón `h-dvh overflow-hidden`: el documento
// nunca debería tener scroll propio, solo lo tiene `<main>`. Los radios del
// selector son `sr-only`, es decir `position: absolute`; si su etiqueta no crea
// un bloque contenedor, el bloque contenedor pasa a ser el inicial, los radios
// quedan anclados al documento muy por debajo del armazón, el documento gana
// scroll y al enfocarlos el navegador desplaza la ventana entera: el armazón se
// va hacia arriba y debajo solo queda el blanco del body.
//
// Por eso la prueba mide el documento, no la apariencia del selector: jsdom no
// calcula posiciones, así que esto solo se detecta en un navegador real.
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
  colorPrimario: '#9333EA',
  descripcion: null,
  logoUrl: null,
  portadaUrl: null,
  portadaPreset: null,
  planNombre: 'Básico',
};

/** True only when the path exactly equals the API route (no /src/ prefix). */
const isApiPath = (url: URL, pathname: string) => url.pathname === pathname;

const json = (body: unknown) => ({
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/** Geometry of the page as a whole, which is what the defect corrupted. */
const medir = () => {
  const de = document.documentElement;
  const main = document.querySelector('main')!;
  const armazon = main.closest('.h-dvh')!.getBoundingClientRect();
  return {
    windowScrollY: window.scrollY,
    docScrollHeight: de.scrollHeight,
    docClientHeight: de.clientHeight,
    mainScrollTop: Math.round(main.scrollTop),
    armazonTop: Math.round(armazon.top),
    armazonBottom: Math.round(armazon.bottom),
  };
};

test.describe('Selector de fondo de portada', () => {
  test.beforeEach(async ({ page }) => {
    // Red de seguridad: cualquier endpoint que no se simule abajo devolvería 401
    // contra la API real, el interceptor cerraría la sesión y la prueba acabaría
    // en /login. Se registra primero porque Playwright da prioridad al último.
    await page.route((url) => url.pathname.startsWith('/api/'), (r) => r.fulfill(json([])));

    // Solo hacen falta dos respuestas con forma propia: el resto del dashboard se
    // conforma con la lista vacía de arriba.
    await page.route((url) => isApiPath(url, '/api/auth/login'), (r) => r.fulfill(json(LOGIN_RESPONSE)));
    await page.route((url) => isApiPath(url, '/api/negocios/perfil'), (r) => r.fulfill(json(PERFIL_NEGOCIO)));

    await page.goto('/login');
    await page.getByPlaceholder('correo@ejemplo.com').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByPlaceholder('correo@ejemplo.com').fill('admin@salon.com');
    await page.getByPlaceholder('••••••••').fill('Password1');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL('**/dashboard**', { timeout: 10_000 });

    // Navegación del lado del cliente: una recarga perdería la sesión simulada.
    await page.getByRole('link', { name: 'Mi negocio' }).click();
    await page.waitForURL('**/dashboard/perfil', { timeout: 10_000 });
    await page.getByRole('group', { name: 'Fondo de portada' }).waitFor({ state: 'visible', timeout: 10_000 });
  });

  for (const vp of [
    { nombre: 'escritorio', width: 1280, height: 800 },
    { nombre: 'móvil', width: 390, height: 844 },
  ]) {
    test(`en ${vp.nombre} elegir un fondo no desplaza la página ni vacía el armazón`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // El cambio de ancho rehace el layout; medir antes daría posiciones viejas.
      await page.waitForTimeout(500);

      // Deja el selector a la vista desplazando SOLO el contenedor del contenido,
      // y devuelve la ventana a cero para que la medición no arrastre ruido.
      await page.evaluate(() => {
        const grupo = document.querySelector<HTMLElement>('[aria-label="Fondo de portada"]')!;
        document.querySelector('main')!.scrollTop = grupo.offsetTop - 120;
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(200);

      const antes = await page.evaluate(medir);

      // El documento no debe tener scroll propio: si lo tiene, algo se escapó del
      // armazón. Esto ya fallaba antes de hacer clic (scrollHeight 2160 vs 800).
      expect(antes.docScrollHeight).toBe(antes.docClientHeight);
      expect(antes.windowScrollY).toBe(0);

      // Elige varias tarjetas que estén completas dentro del contenedor: una
      // tarjeta cortada por el borde sí merece que el navegador la acerque.
      const elegibles = await page.evaluate(() => {
        const m = document.querySelector('main')!.getBoundingClientRect();
        // `sr-only` lleva `margin: -1px`, así que el radio asoma 1px por encima de
        // su etiqueta; se pide holgura para no medir justo en ese límite.
        const holgura = 8;
        return [...document.querySelectorAll<HTMLInputElement>('input[name="fondo-portada"]')]
          .map((input, i) => ({ i, label: input.parentElement as HTMLElement }))
          .filter(({ label }) => {
            const r = label.getBoundingClientRect();
            return r.top >= m.top + holgura && r.bottom <= m.bottom - holgura;
          })
          .map(({ i, label }) => ({ i, nombre: label.textContent!.trim() }));
      });
      expect(elegibles.length).toBeGreaterThanOrEqual(3);

      for (const { i, nombre } of elegibles.slice(0, 5)) {
        const tarjeta = page.locator('input[name="fondo-portada"]').nth(i).locator('xpath=../span[1]');
        await tarjeta.click();

        const despues = await page.evaluate(medir);
        // 1) La ventana no se mueve y el documento sigue sin scroll propio.
        expect(despues.windowScrollY, `tras elegir "${nombre}"`).toBe(0);
        expect(despues.docScrollHeight, `tras elegir "${nombre}"`).toBe(despues.docClientHeight);
        // 2) El armazón sigue llenando la ventana: nada de franja blanca debajo.
        expect(despues.armazonTop, `tras elegir "${nombre}"`).toBe(0);
        expect(despues.armazonBottom, `tras elegir "${nombre}"`).toBe(vp.height);
        // 3) El contenido tampoco salta: la tarjeta ya estaba a la vista.
        expect(despues.mainScrollTop, `tras elegir "${nombre}"`).toBe(antes.mainScrollTop);
        // 4) Y la elección sí quedó registrada.
        await expect(page.locator('input[name="fondo-portada"]').nth(i)).toBeChecked();
      }
    });
  }

  test('las flechas mueven la selección sin desplazar la ventana', async ({ page }) => {
    await page.evaluate(() => {
      const grupo = document.querySelector<HTMLElement>('[aria-label="Fondo de portada"]')!;
      document.querySelector('main')!.scrollTop = grupo.offsetTop - 120;
      window.scrollTo(0, 0);
    });

    const radios = page.locator('input[name="fondo-portada"]');
    await radios.nth(1).focus();
    await page.keyboard.press('ArrowRight');
    await expect(radios.nth(2)).toBeChecked();

    const despues = await page.evaluate(medir);
    expect(despues.windowScrollY).toBe(0);
    expect(despues.docScrollHeight).toBe(despues.docClientHeight);
    expect(despues.armazonTop).toBe(0);
  });
});
