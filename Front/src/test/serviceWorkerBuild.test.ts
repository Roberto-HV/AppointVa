import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Regresión: entre agosto y noviembre de 2026 las notificaciones push estuvieron
 * muertas en producción porque `vite-plugin-pwa` (modo generateSW) emitía su
 * propio worker sobre `public/sw.js` y se llevaba por delante los handlers
 * escritos a mano. El código fuente estaba bien; lo que fallaba era el build,
 * así que este test mira el artefacto emitido y no las fuentes.
 */

const raizFront = path.resolve(__dirname, "../..");
const dist = path.join(raizFront, "dist");
const swGenerado = path.join(dist, "sw.js");
const scriptPush = path.join(dist, "push-sw.js");

function construirSiFalta(): void {
  if (existsSync(swGenerado) && existsSync(scriptPush)) return;
  // Vitest deja NODE_ENV=test y con eso Vite no minifica: se fuerza production
  // para revisar el mismo artefacto que se despliega.
  execFileSync("npx", ["vite", "build", "--mode", "production"], {
    cwd: raizFront,
    stdio: "ignore",
    shell: true,
    env: { ...process.env, NODE_ENV: "production" },
  });
}

describe("service worker emitido por el build", () => {
  let sw = "";
  let push = "";

  beforeAll(() => {
    construirSiFalta();
    sw = readFileSync(swGenerado, "utf8");
    push = readFileSync(scriptPush, "utf8");
  }, 180_000);

  it("importa el script de push desde el worker generado", () => {
    expect(sw).toMatch(/importScripts\(\s*"\/push-sw\.js"\s*\)/);
  });

  it("emite el script de push a dist", () => {
    expect(existsSync(scriptPush)).toBe(true);
  });

  it("registra los handlers de push y de clic alcanzables desde el worker desplegado", () => {
    expect(push).toMatch(/addEventListener\(\s*["']push["']/);
    expect(push).toMatch(/addEventListener\(\s*["']notificationclick["']/);
    expect(push).toContain("showNotification");
  });

  it("versiona el script de push en el manifiesto de precaché", () => {
    // Sin esta entrada, cambiar push-sw.js no cambiaría los bytes de sw.js y el
    // navegador nunca detectaría la actualización del worker. El orden de las
    // claves depende de si el build minificó o no, así que se aceptan ambos.
    const minificado = /\{\s*url:\s*"push-sw\.js"\s*,\s*revision:\s*"[0-9a-f]{32}"\s*\}/;
    const expandido = /"revision":\s*"[0-9a-f]{32}"\s*,\s*"url":\s*"push-sw\.js"/;
    expect(minificado.test(sw) || expandido.test(sw)).toBe(true);
  });

  it("consulta la red antes que la caché de imágenes para las rutas de API", () => {
    const api = sw.search(/NetworkOnly/);
    const imagenes = sw.search(/cacheName:\s*"images"/);
    expect(api).toBeGreaterThan(-1);
    expect(imagenes).toBeGreaterThan(-1);
    // Workbox evalúa las rutas en orden de registro.
    expect(api).toBeLessThan(imagenes);
  });
});
