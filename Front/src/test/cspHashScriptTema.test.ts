import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * El script de tema vive inline en index.html porque tiene que correr antes del
 * primer pintado: si se externaliza vuelve el parpadeo claro→oscuro del panel.
 * Para que la CSP lo admita sin `'unsafe-inline'`, su sha256 va fijado a mano en
 * `script-src` dentro de vercel.json. Nada en el build enlaza esas dos piezas,
 * así que editar el script deja el hash viejo y el navegador bloquea el script
 * en silencio: la app sigue funcionando y solo reaparece el parpadeo de tema.
 * Este test es lo único que separa ese cambio de esa regresión en producción.
 *
 * Se mira el artefacto emitido y no la fuente porque el navegador hashea los
 * bytes servidos, no los del repo.
 */

const raizFront = path.resolve(__dirname, "../..");
const dist = path.join(raizFront, "dist");
const indexGenerado = path.join(dist, "index.html");
const configVercel = path.join(raizFront, "vercel.json");

const COMO_REGENERAR =
  "Para regenerarlo: `npm run build` y luego " +
  '`node -e "const c=require(\'crypto\'),f=require(\'fs\');' +
  "const s=f.readFileSync('dist/index.html','utf8').match(/<script>([\\s\\S]*?)<\\/script>/)[1];" +
  "console.log('sha256-'+c.createHash('sha256').update(s.replace(/\\r\\n/g,'\\n')).digest('base64'))\"`, " +
  "y reemplazar el 'sha256-...' de script-src en vercel.json.";

describe("hash CSP del script de tema inline", () => {
  let hashEsperado = "";
  let scriptSrc = "";

  beforeAll(() => {
    // El build que deja dist/ al día lo corre el globalSetup de Vitest una sola
    // vez por ejecución (src/test/globalSetup.ts → src/test/construirDist.ts);
    // aquí solo se lee.
    expect(
      existsSync(indexGenerado),
      "Falta dist/index.html: lo emite el build que prepara el globalSetup de Vitest (src/test/globalSetup.ts). Revisa la salida de ese paso en vez de construir dist/ a mano.",
    ).toBe(true);

    const html = readFileSync(indexGenerado, "utf8");
    const encontrado = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(
      encontrado,
      "dist/index.html ya no trae el script de tema inline; si se externalizó, vuelve el parpadeo de tema en el primer pintado.",
    ).not.toBeNull();

    // El parser de HTML normaliza CRLF→LF antes de que la CSP hashee el
    // contenido del <script>, así que el hash se calcula siempre sobre LF.
    // Importa en este repo: `core.autocrlf=true` deja el worktree de Windows con
    // CRLF mientras que git guarda el archivo con LF, y aun así el navegador
    // hashea lo mismo en ambos lados. Verificado en Chrome: un hash calculado
    // sobre los bytes CRLF se bloquea con script-src-elem/inline.
    const cuerpoNormalizado = encontrado![1].replace(/\r\n/g, "\n");
    hashEsperado = `sha256-${createHash("sha256").update(cuerpoNormalizado, "utf8").digest("base64")}`;

    const vercel = JSON.parse(readFileSync(configVercel, "utf8"));
    const csp = vercel.headers
      ?.flatMap((regla: { headers?: { key: string; value: string }[] }) => regla.headers ?? [])
      .find((h: { key: string }) => h.key === "Content-Security-Policy")?.value as string | undefined;
    expect(csp, "vercel.json no define Content-Security-Policy.").toBeDefined();

    scriptSrc =
      csp!
        .split(";")
        .map((directiva) => directiva.trim())
        .find((directiva) => directiva.startsWith("script-src")) ?? "";
    expect(scriptSrc, "la CSP de vercel.json no define script-src.").not.toBe("");
  }, 180_000);

  it("fija en script-src el hash del script inline que emite el build", () => {
    expect(
      scriptSrc,
      `El script de tema inline de dist/index.html cambió y su hash ya no está en script-src de vercel.json: producción lo bloqueará y volverá el parpadeo de tema. Esperado ${hashEsperado}. ${COMO_REGENERAR}`,
    ).toContain(`'${hashEsperado}'`);
  });

  it("no habilita 'unsafe-inline' en script-src", () => {
    // Con 'unsafe-inline' el hash deja de tener efecto y la CSP deja de
    // proteger contra inyección de scripts.
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});
