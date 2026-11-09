import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Los tests de artefacto (serviceWorkerBuild y cspHashScriptTema) leen `dist/`
 * en vez de las fuentes, porque el navegador sirve y hashea los bytes emitidos.
 * Antes cada archivo construía por su cuenta usando `existsSync` como guarda, y
 * de ahí salían dos fallas:
 *
 * 1. Un `dist/` viejo dejaba los dos tests en verde contra el artefacto
 *    equivocado. `dist/` está en .gitignore y sobrevive entre ramas, así que
 *    editar el script de tema o reordenar las reglas de Workbox no rompía nada
 *    en local mientras el despliegue sí cambiaba.
 * 2. En un checkout limpio los dos archivos construían a la vez, cada uno desde
 *    su worker. `emptyOutDir` vacía `dist/` al empezar cada build, así que uno
 *    podía leer los archivos mientras el otro los borraba o reescribía.
 *
 * Aquí el build es uno solo, lo dispara el globalSetup de Vitest (una vez por
 * ejecución y antes de que arranquen los workers) y únicamente cuando cambió
 * alguna de las entradas de las que dependen esas aserciones.
 */

const raizFront = path.resolve(__dirname, "../..");
const dist = path.join(raizFront, "dist");
const archivoHuella = path.join(dist, ".huella-tests.json");

// Las entradas que mueven el artefacto revisado por esos tests: el script de
// tema inline, la configuración de Workbox y los handlers de push.
const entradas = [
  path.join(raizFront, "index.html"),
  path.join(raizFront, "vite.config.ts"),
  path.join(raizFront, "public", "push-sw.js"),
];

function calcularHuella(): string {
  const hash = createHash("sha256");

  for (const entrada of entradas) {
    hash.update(path.relative(raizFront, entrada).replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(existsSync(entrada) ? readFileSync(entrada) : Buffer.from("(ausente)"));
    hash.update("\0");
  }

  // La versión de Vite entra en la huella porque el test de CSP hashea el
  // script inline tal como lo emite el build: hoy Vite no lo minifica, y una
  // subida de versión que empiece a minificarlo cambiaría ese hash sin que
  // index.html se haya tocado.
  const paqueteVite = JSON.parse(
    readFileSync(path.join(raizFront, "node_modules", "vite", "package.json"), "utf8"),
  ) as { version?: string };
  hash.update(`vite@${paqueteVite.version ?? "desconocida"}`);

  return hash.digest("hex");
}

function huellaSellada(): string | null {
  if (!existsSync(archivoHuella)) return null;
  try {
    const sello = JSON.parse(readFileSync(archivoHuella, "utf8")) as { huella?: string };
    return typeof sello.huella === "string" ? sello.huella : null;
  } catch {
    // Un sello ilegible se trata como ausente: vuelve a construir una vez.
    return null;
  }
}

/**
 * Deja `dist/` al día con las fuentes. No hace nada cuando la huella sellada en
 * el build anterior coincide, así que la ejecución habitual de la suite no paga
 * ningún build.
 */
export function construirDistSiCambio(): void {
  const huella = calcularHuella();
  if (huellaSellada() === huella) return;

  // Vitest deja NODE_ENV=test y con eso Vite no minifica: se fuerza production
  // para revisar el mismo artefacto que se despliega.
  try {
    execFileSync("npx", ["vite", "build", "--mode", "production"], {
      cwd: raizFront,
      // Nada de `stdio: "ignore"`: cuando el build falla, su salida es el único
      // diagnóstico y sin ella el fallo aparece como un ENOENT pelado al leer
      // dist/ desde los tests.
      stdio: "pipe",
      shell: true,
      env: { ...process.env, NODE_ENV: "production" },
    });
  } catch (error) {
    const salida = error as { stdout?: Buffer; stderr?: Buffer };
    const detalle = [salida.stdout?.toString(), salida.stderr?.toString()]
      .filter((parte): parte is string => Boolean(parte))
      .join("\n")
      .trim();
    throw new Error(
      "Falló `vite build --mode production` al preparar dist/ para los tests de artefacto." +
        (detalle ? `\n\nSalida del build:\n${detalle}` : ""),
    );
  }

  // El sello vive dentro de `dist/` a propósito: `emptyOutDir` lo borra al
  // empezar cada build, así que un `dist/` vaciado, armado a mano o traído de
  // otra rama no tiene sello y obliga a reconstruir una vez.
  writeFileSync(archivoHuella, `${JSON.stringify({ huella }, null, 2)}\n`, "utf8");
}
