import type { FondoPortada } from "./portadaPresets";

// ── Fondos de materiales ──────────────────────────────────────────────────────
// A diferencia del resto del catálogo, estos fondos no salen del color de marca:
// imitan una superficie real (cuarzo, mármol, duela, piel…) y sus colores están
// curados a mano.
//
// El dibujo vive en `portadaMaterialesSvg.ts`, pero el navegador ya no lo pinta:
// los filtros SVG salían dentados en portadas de escritorio y distintos en cada
// motor. `npm run portadas` los renderiza con supermuestreo y deja un WebP por
// material en `public/portadas`; aquí solo se apunta a esas imágenes, encima del
// color liso del material, que es lo que se ve mientras la imagen llega.

/**
 * Color liso de cada material (el tono medio de su base): lo que pinta la
 * portada mientras carga la imagen y la miniatura del selector antes de verse.
 */
export const BASE_MATERIALES: Record<string, string> = {
  "mat-cuarzo-blanco": "#efebe4",
  "mat-cuarzo-negro": "#141518",
  "mat-marmol-carrara": "#eeeeeb",
  "mat-marmol-verde": "#0d3a2d",
  "mat-rosa-cuarzo": "#f0d6cd",
  "mat-duela-clara": "#d6b48a",
  "mat-duela-oscura": "#5a3a24",
  "mat-madera": "#7a4b2a",
  "mat-terrazo": "#ede6da",
  "mat-concreto": "#babab5",
  "mat-lino": "#e6ddcd",
  "mat-pizarra": "#2e353b",
  "mat-cuero": "#4f2f1c",
};

/** Oscurece el pie de la portada, donde va el nombre en blanco. */
const PIE_OSCURO = "linear-gradient(180deg, rgba(8,8,10,0) 40%, rgba(8,8,10,0.5) 100%)";

/**
 * Materiales oscuros que llevan el pie oscurecido. Va en CSS y no dentro de la
 * imagen: así acompaña la altura real de la portada, recorte aparte.
 */
const CON_PIE_OSCURO = new Set([
  "mat-cuarzo-negro",
  "mat-marmol-verde",
  "mat-duela-oscura",
  "mat-madera",
  "mat-pizarra",
  "mat-cuero",
]);

/** Ruta pública del WebP de un material; la miniatura pesa una fracción. */
export function urlMaterial(clave: string, miniatura = false): string {
  return `/portadas/${clave}${miniatura ? "-mini" : ""}.webp`;
}

function material(clave: string, miniatura: boolean): FondoPortada {
  const capas = [
    CON_PIE_OSCURO.has(clave) ? PIE_OSCURO : undefined,
    `url("${urlMaterial(clave, miniatura)}") center / cover no-repeat`,
    BASE_MATERIALES[clave],
  ].filter((c): c is string => !!c);
  return { background: capas.join(", ") };
}

export const CONSTRUCTORES_MATERIALES: Record<string, () => FondoPortada> = Object.fromEntries(
  Object.keys(BASE_MATERIALES).map((clave) => [clave, () => material(clave, false)]),
);

/** Lo mismo con la imagen chica: para muestras del tamaño de una tarjeta. */
export const MINIATURAS_MATERIALES: Record<string, () => FondoPortada> = Object.fromEntries(
  Object.keys(BASE_MATERIALES).map((clave) => [clave, () => material(clave, true)]),
);
