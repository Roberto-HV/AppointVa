import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5291',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // La suite levanta SIEMPRE su propio servidor. Antes reutilizaba cualquiera que
  // ya estuviera escuchando, y Playwright no comprueba qué aplicación contesta:
  // basta con que algo conteste. Con otro proyecto ocupando el puerto, la suite
  // entera corrió contra esa app y falló con un 404 de React Router en el primer
  // paso, un síntoma que parece deriva de la prueba y no lo es.
  //
  // `--strictPort` es parte del arreglo: sin él Vite se mudaría en silencio a otro
  // puerto si el 5291 estuviera ocupado, y la comprobación de `url` volvería a dar
  // con lo que sea que esté ahí. Así falla de frente en vez de mentir.
  webServer: {
    command: 'npm run dev -- --port 5291 --strictPort',
    url: 'http://localhost:5291',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
