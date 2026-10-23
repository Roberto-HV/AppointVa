import type { CSSProperties } from "react";
import {
  DEFAULT_COLOR,
  contrasteSobreBlanco,
  degradeGradient,
  hexToHsl,
  hslARgb,
} from "./colorUtils";

// ── Fondos de portada generados por código ────────────────────────────────────
// Un negocio sin una buena foto igual tiene que verse profesional. En vez de
// fotos de stock —que pesan en datos móviles y acaban repetidas entre clientes—
// cada fondo se dibuja con degradados CSS y SVG en línea a partir del color de
// marca del propio negocio, así dos negocios nunca comparten portada.
//
// Este módulo es la única fuente: lo consumen la página pública y el selector
// del dashboard, para que la vista previa no se despegue de lo que el cliente ve.

export type FamiliaPortada = "geometrico" | "degradado" | "textura";

export interface PresetPortada {
  clave: string;
  nombre: string;
  familia: FamiliaPortada;
}

export interface FamiliaPortadaInfo {
  familia: FamiliaPortada;
  titulo: string;
  descripcion: string;
}

/** Lo que hay que aplicar al contenedor de la portada para dibujar el fondo. */
export interface FondoPortada extends CSSProperties {
  background: string;
  backgroundBlendMode?: string;
}

export const FAMILIAS_PORTADA: FamiliaPortadaInfo[] = [
  {
    familia: "geometrico",
    titulo: "Geométricos",
    descripcion: "Trazos finos y repetidos sobre un fondo profundo.",
  },
  {
    familia: "degradado",
    titulo: "Degradados",
    descripcion: "Luz suave, sin bordes duros.",
  },
  {
    familia: "textura",
    titulo: "Texturas",
    descripcion: "Grano fino que le quita el aspecto plano al color.",
  },
];

export const PRESETS_PORTADA: PresetPortada[] = [
  { clave: "geo-diagonales", nombre: "Diagonales", familia: "geometrico" },
  { clave: "geo-reticula", nombre: "Retícula", familia: "geometrico" },
  { clave: "geo-rombos", nombre: "Rombos", familia: "geometrico" },
  { clave: "geo-arcos", nombre: "Arcos", familia: "geometrico" },
  { clave: "deg-aurora", nombre: "Aurora", familia: "degradado" },
  { clave: "deg-malla", nombre: "Malla", familia: "degradado" },
  { clave: "deg-amanecer", nombre: "Amanecer", familia: "degradado" },
  { clave: "deg-halo", nombre: "Halo", familia: "degradado" },
  { clave: "tex-arena", nombre: "Arena", familia: "textura" },
  { clave: "tex-niebla", nombre: "Niebla", familia: "textura" },
  { clave: "tex-vetas", nombre: "Vetas", familia: "textura" },
  { clave: "tex-terrazo", nombre: "Terrazo", familia: "textura" },
];

export function esPresetPortadaValido(clave: string | null | undefined): boolean {
  return !!clave && PRESETS_PORTADA.some((p) => p.clave === clave);
}

/**
 * Clave que hay que dibujar para lo que el negocio tenga guardado: la misma si
 * está en el catálogo, o `null` (sin preset: foto o color de marca) si está vacía
 * o es desconocida. No hay reasignaciones: un fondo guardado se ve siempre igual.
 */
export function normalizarPresetPortada(clave: string | null | undefined): string | null {
  return esPresetPortadaValido(clave) ? clave! : null;
}

export function presetsPorFamilia(familia: FamiliaPortada): PresetPortada[] {
  return PRESETS_PORTADA.filter((p) => p.familia === familia);
}

// ── Utilidades internas ───────────────────────────────────────────────────────

interface OpcionesTono {
  /** Grados de giro sobre el matiz de marca, para acompañar sin salirse de la paleta. */
  giro?: number;
  sat?: number;
  alfa?: number;
}

/**
 * Cuánto hay que bajar la rampa de luz del preset para este matiz. La L de HSL no
 * es luminancia: un dorado y un morado al mismo 45% pesan muy distinto, y sobre el
 * dorado el texto blanco de la portada se cae del 4.5:1. Se busca el factor que
 * deja el tono medio de la marca pesando como un gris equivalente; un matiz que ya
 * es más oscuro que el gris se queda como está (nunca se aclara el diseño).
 */
function factorLuz(matiz: number, sat: number): number {
  const objetivo = contrasteSobreBlanco(hslARgb(0, 0, 50));
  let k = 1;
  while (k > 0.4 && contrasteSobreBlanco(hslARgb(matiz, sat, 50 * k)) < objetivo) {
    k -= 0.02;
  }
  return k;
}

function paleta(hex: string) {
  const [matiz, saturacion] = hexToHsl(hex || DEFAULT_COLOR);
  // Un magenta puro al 100% de saturación quema el fondo; el tope lo contiene.
  const satBase = Math.min(saturacion, 88);
  const k = factorLuz(matiz, satBase);

  function tono(luz: number, opts: OpcionesTono = {}): string {
    const h = Math.round((((matiz + (opts.giro ?? 0)) % 360) + 360) % 360);
    const s = Math.round(Math.max(0, Math.min(100, opts.sat ?? satBase)));
    const l = Math.round(Math.max(0, Math.min(100, luz * k)));
    return opts.alfa === undefined
      ? `hsl(${h},${s}%,${l}%)`
      : `hsla(${h},${s}%,${l}%,${opts.alfa})`;
  }

  return { tono };
}

function svgUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Ruido en escala de grises; se mezcla con el degradado de abajo, no lo tapa. */
function svgRuido(frecuencia: string, octavas: number, opacidad: number, lado: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}">` +
    `<filter id="r" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${frecuencia}" numOctaves="${octavas}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#r)" opacity="${opacidad}"/>` +
    `</svg>`
  );
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

type Constructor = (hex: string) => FondoPortada;

const CONSTRUCTORES: Record<string, Constructor> = {
  "geo-diagonales": (hex) => {
    const { tono } = paleta(hex);
    return {
      background: [
        `repeating-linear-gradient(135deg, ${tono(72, { alfa: 0.085 })} 0 2px, transparent 2px 15px)`,
        `linear-gradient(162deg, ${tono(27)} 0%, ${tono(15)} 56%, ${tono(8)} 100%)`,
      ].join(", "),
    };
  },

  "geo-reticula": (hex) => {
    const { tono } = paleta(hex);
    const linea = tono(74, { alfa: 0.07 });
    return {
      background: [
        `repeating-linear-gradient(0deg, ${linea} 0 1px, transparent 1px 30px)`,
        `repeating-linear-gradient(90deg, ${linea} 0 1px, transparent 1px 30px)`,
        `radial-gradient(ellipse 130% 95% at 50% -10%, ${tono(32)} 0%, ${tono(10)} 100%)`,
      ].join(", "),
    };
  },

  "geo-rombos": (hex) => {
    const { tono } = paleta(hex);
    const linea = tono(76, { alfa: 0.065 });
    return {
      background: [
        `repeating-linear-gradient(45deg, ${linea} 0 1.5px, transparent 1.5px 22px)`,
        `repeating-linear-gradient(-45deg, ${linea} 0 1.5px, transparent 1.5px 22px)`,
        `linear-gradient(200deg, ${tono(29, { giro: 14 })} 0%, ${tono(14)} 58%, ${tono(8)} 100%)`,
      ].join(", "),
    };
  },

  "geo-arcos": (hex) => {
    const { tono } = paleta(hex);
    // Los centros caen en las esquinas del mosaico: los arcos de dos baldosas
    // vecinas cierran el círculo y la repetición no deja costura visible.
    const trazo = tono(80);
    const arcos =
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">` +
      `<g fill="none" stroke="${trazo}" stroke-opacity="0.15" stroke-width="1.5">` +
      [30, 58, 86, 114]
        .map((r) => `<circle cx="0" cy="128" r="${r}"/><circle cx="128" cy="0" r="${r}"/>`)
        .join("") +
      `</g></svg>`;
    return {
      background: [
        `${svgUrl(arcos)} 0 0 / 128px 128px repeat`,
        `linear-gradient(172deg, ${tono(31)} 0%, ${tono(14)} 62%, ${tono(9)} 100%)`,
      ].join(", "),
    };
  },

  "deg-aurora": (hex) => {
    const { tono } = paleta(hex);
    return {
      background: [
        `radial-gradient(ellipse 72% 88% at 12% 6%, ${tono(55, { alfa: 0.58 })} 0%, transparent 62%)`,
        `radial-gradient(ellipse 88% 72% at 88% 20%, ${tono(48, { giro: 32, alfa: 0.44 })} 0%, transparent 65%)`,
        `radial-gradient(ellipse 110% 65% at 48% 112%, ${tono(40, { giro: -26, alfa: 0.38 })} 0%, transparent 70%)`,
        `linear-gradient(180deg, ${tono(13)} 0%, ${tono(7)} 100%)`,
      ].join(", "),
    };
  },

  "deg-malla": (hex) => {
    const { tono } = paleta(hex);
    return {
      background: [
        `radial-gradient(circle at 18% 20%, ${tono(53, { alfa: 0.52 })} 0%, transparent 55%)`,
        `radial-gradient(circle at 84% 16%, ${tono(45, { giro: 22, alfa: 0.42 })} 0%, transparent 52%)`,
        `radial-gradient(circle at 24% 88%, ${tono(41, { giro: -20, alfa: 0.4 })} 0%, transparent 58%)`,
        `radial-gradient(circle at 80% 90%, ${tono(47, { giro: 44, alfa: 0.36 })} 0%, transparent 55%)`,
        `linear-gradient(135deg, ${tono(15)} 0%, ${tono(9)} 100%)`,
      ].join(", "),
    };
  },

  "deg-amanecer": (hex) => {
    const { tono } = paleta(hex);
    return {
      background: [
        `linear-gradient(180deg, transparent 52%, ${tono(6, { alfa: 0.8 })} 100%)`,
        `radial-gradient(ellipse 135% 62% at 50% 76%, ${tono(60, { alfa: 0.58 })} 0%, ${tono(44, { giro: 18, alfa: 0.26 })} 44%, transparent 72%)`,
        `linear-gradient(180deg, ${tono(8)} 0%, ${tono(14)} 58%, ${tono(10)} 100%)`,
      ].join(", "),
    };
  },

  "deg-halo": (hex) => {
    const { tono } = paleta(hex);
    return {
      background: [
        `radial-gradient(ellipse 86% 112% at 50% 36%, ${tono(51, { alfa: 0.5 })} 0%, transparent 62%)`,
        `radial-gradient(ellipse 125% 125% at 50% 50%, transparent 38%, ${tono(5, { alfa: 0.65 })} 100%)`,
        `linear-gradient(180deg, ${tono(14)} 0%, ${tono(8)} 100%)`,
      ].join(", "),
    };
  },

  "tex-arena": (hex) => {
    const { tono } = paleta(hex);
    return {
      background: [
        `${svgUrl(svgRuido("0.85", 4, 0.55, 180))} 0 0 / 180px 180px repeat`,
        `linear-gradient(165deg, ${tono(28)} 0%, ${tono(14)} 60%, ${tono(8)} 100%)`,
      ].join(", "),
      backgroundBlendMode: "soft-light, normal",
    };
  },

  "tex-niebla": (hex) => {
    const { tono } = paleta(hex);
    // Frecuencia muy baja y bastantes octavas: manchas grandes y blandas, no grano.
    return {
      background: [
        `${svgUrl(svgRuido("0.009", 5, 0.95, 800))} 0 0 / 800px 800px repeat`,
        `radial-gradient(ellipse 95% 85% at 26% 10%, ${tono(50, { alfa: 0.5 })} 0%, transparent 66%)`,
        `radial-gradient(ellipse 80% 70% at 86% 72%, ${tono(42, { giro: 26, alfa: 0.4 })} 0%, transparent 64%)`,
        `linear-gradient(170deg, ${tono(20)} 0%, ${tono(9)} 100%)`,
      ].join(", "),
      backgroundBlendMode: "overlay, normal, normal, normal",
    };
  },

  "tex-vetas": (hex) => {
    const { tono } = paleta(hex);
    // Frecuencia baja en X y alta en Y: el ruido se estira en horizontal y
    // aparecen vetas, como piedra laminada.
    return {
      background: [
        `${svgUrl(svgRuido("0.006 0.75", 3, 0.5, 600))} 0 0 / 600px 600px repeat`,
        `linear-gradient(180deg, ${tono(26, { giro: 12 })} 0%, ${tono(13)} 55%, ${tono(8)} 100%)`,
      ].join(", "),
      backgroundBlendMode: "overlay, normal",
    };
  },

  "tex-terrazo": (hex) => {
    const { tono } = paleta(hex);
    const motas: [number, number, number, string][] = [
      [14, 22, 5, tono(68, { alfa: 0.3 })],
      [48, 10, 3, tono(80, { alfa: 0.22 })],
      [88, 34, 6, tono(58, { giro: 24, alfa: 0.28 })],
      [120, 18, 3.5, tono(74, { alfa: 0.2 })],
      [30, 62, 4, tono(62, { giro: -18, alfa: 0.26 })],
      [70, 76, 6.5, tono(70, { alfa: 0.24 })],
      [104, 92, 3, tono(82, { alfa: 0.22 })],
      [18, 104, 5.5, tono(60, { giro: 30, alfa: 0.26 })],
      [56, 122, 3.5, tono(76, { alfa: 0.2 })],
      [128, 112, 4.5, tono(64, { alfa: 0.24 })],
      [92, 52, 2.5, tono(86, { alfa: 0.2 })],
      [6, 78, 3, tono(72, { giro: -30, alfa: 0.22 })],
      [136, 64, 3.5, tono(66, { alfa: 0.22 })],
      [44, 40, 2.5, tono(84, { alfa: 0.18 })],
    ];
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">` +
      motas.map(([cx, cy, r, fill]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`).join("") +
      `</svg>`;
    return {
      background: [
        `${svgUrl(svg)} 0 0 / 144px 144px repeat`,
        `${svgUrl(svgRuido("0.9", 3, 0.4, 160))} 0 0 / 160px 160px repeat`,
        `linear-gradient(158deg, ${tono(24)} 0%, ${tono(13)} 62%, ${tono(8)} 100%)`,
      ].join(", "),
      backgroundBlendMode: "normal, soft-light, normal",
    };
  },
};

/**
 * Fondo de la portada para una clave de preset y el color de marca del negocio.
 * Una clave vacía o desconocida cae al degradado de marca de siempre, que es el
 * fondo que la página pública ya usaba: si el catálogo cambia, ninguna portada
 * publicada se queda en blanco.
 */
export function fondoPortada(clave: string | null | undefined, hex: string): FondoPortada {
  const color = hex || DEFAULT_COLOR;
  const vigente = normalizarPresetPortada(clave);
  const constructor = vigente ? CONSTRUCTORES[vigente] : undefined;
  if (!constructor) return { background: degradeGradient(color) };
  return constructor(color);
}
