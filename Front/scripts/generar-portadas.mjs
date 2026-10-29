// Genera los WebP de los fondos de materiales (public/portadas/<clave>.webp).
//
// Uso: npm run portadas   (o: node --experimental-strip-types scripts/generar-portadas.mjs)
//
// La única fuente del dibujo es src/lib/portadaMaterialesSvg.ts: aquí cada
// material se pinta en Chromium tal cual lo pintaba la app (mismo CSS, mismas
// mezclas), pero al doble de densidad. Al reducirlo a la mitad, cada píxel final
// promedia cuatro, y los escalones del ruido de 8 bits —vetas dentadas, grano a
// rayas— se funden. Las imágenes salen iguales en cualquier navegador.
//
// Hay que volver a correrlo cada vez que cambie un material en ese módulo.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { SVG_MATERIALES } from "../src/lib/portadaMaterialesSvg.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = path.join(RAIZ, "public", "portadas");

/** Tamaño final de la portada: 8:3, como el lienzo de 1600×600. */
const ANCHO = 3200;
const ALTO = 1200;
/** Densidad del render: el doble de píxeles por lado que la imagen final. */
const SUPERMUESTREO = 2;
/** Miniatura para el selector del panel: tarjetas de ~200px a densidad 3. */
const ANCHO_MINI = 640;
const ALTO_MINI = 240;
const CALIDAD = 0.82;
const CALIDAD_MINI = 0.8;
/**
 * Tope por portada. Los relieves de grano fino (concreto, terrazo) casi no se
 * comprimen: a calidad 0.82 el concreto pasaba de 1 MB. Para esos se baja la
 * calidad y, si no basta, el tamaño; el grano tapa la pérdida mejor que una veta lisa.
 */
const TOPE_BYTES = 360 * 1024;
const CALIDAD_MINIMA = 0.62;

/**
 * Reduce la captura con mitades sucesivas (cada paso promedia bloques de 2×2,
 * sin el aliasing de saltar de golpe) y la codifica en WebP con el códec de
 * Chromium. Devuelve las dos variantes como data URL.
 */
async function reducirYCodificar(pagina, png) {
  await pagina.setContent("<!doctype html><body style='margin:0'></body>");
  return pagina.evaluate(
    async ({ datos, ancho, alto, anchoMini, altoMini, calidad, calidadMini, tope, calidadMinima }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${datos}`;
      await img.decode();

      function reducir(origen, w, h) {
        const lienzo = document.createElement("canvas");
        lienzo.width = w;
        lienzo.height = h;
        const ctx = lienzo.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(origen, 0, 0, w, h);
        return lienzo;
      }

      function hasta(origen, w, h) {
        let actual = origen;
        let aw = origen.width;
        let ah = origen.height;
        while (aw / 2 >= w) {
          aw = Math.round(aw / 2);
          ah = Math.round(ah / 2);
          actual = reducir(actual, aw, ah);
        }
        return aw === w ? actual : reducir(actual, w, h);
      }

      const completa = hasta(img, ancho, alto);
      const mini = hasta(completa, anchoMini, altoMini);
      // Bytes aproximados de un data URL en base64.
      const bytes = (url) => ((url.length - url.indexOf(",") - 1) * 3) / 4;

      // Primero se baja la calidad; si ni así entra, se achica la imagen (un
      // 2400 de ancho sigue cubriendo una portada de escritorio a densidad 1)
      // y se vuelve a empezar desde la calidad alta.
      let elegida = null;
      for (const w of [ancho, ancho * 0.875, ancho * 0.75, ancho * 0.625]) {
        const lienzo = w === ancho ? completa : hasta(img, w, Math.round((w * alto) / ancho));
        for (let q = calidad; q >= calidadMinima - 1e-9; q = Math.round((q - 0.04) * 100) / 100) {
          const url = lienzo.toDataURL("image/webp", q);
          elegida = { portada: url, calidad: q, ancho: w };
          if (bytes(url) <= tope) break;
        }
        if (bytes(elegida.portada) <= tope) break;
      }
      return { ...elegida, mini: mini.toDataURL("image/webp", calidadMini) };
    },
    {
      datos: png.toString("base64"),
      ancho: ANCHO,
      alto: ALTO,
      anchoMini: ANCHO_MINI,
      altoMini: ALTO_MINI,
      calidad: CALIDAD,
      calidadMini: CALIDAD_MINI,
      tope: TOPE_BYTES,
      calidadMinima: CALIDAD_MINIMA,
    },
  );
}

function aBuffer(dataUrl) {
  if (!dataUrl.startsWith("data:image/webp;base64,")) {
    throw new Error("Chromium no devolvió WebP; revisa la versión del navegador de Playwright.");
  }
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

async function main() {
  const soloEstas = process.argv.slice(2);
  const claves = Object.keys(SVG_MATERIALES).filter(
    (c) => soloEstas.length === 0 || soloEstas.includes(c),
  );
  if (claves.length === 0) throw new Error(`Ninguna clave coincide con: ${soloEstas.join(", ")}`);

  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  try {
    const render = await navegador.newPage({
      viewport: { width: ANCHO, height: ALTO },
      deviceScaleFactor: SUPERMUESTREO,
    });
    const codec = await navegador.newPage({ viewport: { width: 800, height: 600 } });

    for (const clave of claves) {
      const fondo = SVG_MATERIALES[clave]();
      await render.setContent(
        "<!doctype html><html><body style='margin:0;overflow:hidden'>" +
          "<div id='m' style='width:100vw;height:100vh'></div></body></html>",
      );
      await render.evaluate(async (f) => {
        // Decodifica cada SVG antes de pintarlo: si no, la captura puede salir
        // con capas a medio dibujar.
        const urls = [...f.background.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]);
        await Promise.all(
          urls.map((u) => {
            const img = new Image();
            img.src = u;
            return img.decode();
          }),
        );
        const m = document.getElementById("m");
        m.style.background = f.background;
        if (f.backgroundBlendMode) m.style.backgroundBlendMode = f.backgroundBlendMode;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, fondo);
      // Los filtros grandes se rasterizan por mosaicos; un respiro evita capturar a medias.
      await render.waitForTimeout(800);
      const png = await render.screenshot({ type: "png" });

      const { portada, calidad, ancho, mini } = await reducirYCodificar(codec, png);
      const bPortada = aBuffer(portada);
      const bMini = aBuffer(mini);
      await writeFile(path.join(SALIDA, `${clave}.webp`), bPortada);
      await writeFile(path.join(SALIDA, `${clave}-mini.webp`), bMini);
      console.log(
        `${clave.padEnd(22)} ${String(Math.round(bPortada.length / 1024)).padStart(5)} KB (${ancho}px, q ${calidad})` +
          `   mini ${String(Math.round(bMini.length / 1024)).padStart(3)} KB`,
      );
    }
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
