import type { CSSProperties } from "react";
import {
  DEFAULT_COLOR,
  contrasteSobreBlanco,
  degradeGradient,
  hexToHsl,
  hslARgb,
} from "./colorUtils";

// ── Fondos de portada generados por código ────────────────────────────────────
// Un negocio sin una buena foto igual tiene que verse profesional. La portada es,
// en este orden: la foto del negocio, su color de marca (el degradado por defecto,
// sin preset) o un tinte suave derivado de ese mismo color. Nada de patrones: las
// rayas, retículas, rombos y granos se retiraron porque parecían papel tapiz y no
// decían nada del negocio (crítica de diseño, T7).
//
// Este módulo es la única fuente: lo consumen la página pública y el selector
// del dashboard, para que la vista previa no se despegue de lo que el cliente ve.

export interface PresetPortada {
  clave: string;
  nombre: string;
}

/** Lo que hay que aplicar al contenedor de la portada para dibujar el fondo. */
export interface FondoPortada extends CSSProperties {
  background: string;
  backgroundBlendMode?: string;
}

// La clave "deg-halo" se conserva tal cual: los negocios que ya la guardaron
// siguen viendo exactamente el mismo fondo.
export const PRESETS_PORTADA: PresetPortada[] = [
  { clave: "deg-halo", nombre: "Tinte suave" },
];

/**
 * Claves retiradas que algún negocio pudo haber guardado. Los degradados caen en
 * el tinte suave, el más parecido; los patrones y texturas vuelven a "sin preset"
 * (foto si la hay, si no el color de marca). Nunca se rompe una portada publicada.
 */
const PRESETS_RETIRADOS: Record<string, string | null> = {
  "deg-aurora": "deg-halo",
  "deg-malla": "deg-halo",
  "deg-amanecer": "deg-halo",
  "geo-diagonales": null,
  "geo-reticula": null,
  "geo-rombos": null,
  "geo-arcos": null,
  "tex-arena": null,
  "tex-niebla": null,
  "tex-vetas": null,
  "tex-terrazo": null,
};

export function esPresetPortadaValido(clave: string | null | undefined): boolean {
  return !!clave && PRESETS_PORTADA.some((p) => p.clave === clave);
}

/**
 * Clave vigente para lo que el negocio tenga guardado: la misma si sigue en el
 * catálogo, su reemplazo si se retiró, o `null` (sin preset) si es desconocida.
 */
export function normalizarPresetPortada(clave: string | null | undefined): string | null {
  if (!clave) return null;
  if (esPresetPortadaValido(clave)) return clave;
  return PRESETS_RETIRADOS[clave] ?? null;
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

// ── Catálogo ──────────────────────────────────────────────────────────────────

type Constructor = (hex: string) => FondoPortada;

const CONSTRUCTORES: Record<string, Constructor> = {
  // Tinte suave: una luz amplia del color de marca sobre su versión profunda.
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
};

/**
 * Fondo de la portada para una clave de preset y el color de marca del negocio.
 * Una clave retirada cae en su reemplazo (normalizarPresetPortada); una vacía o
 * desconocida, al degradado de marca de siempre: si el catálogo cambia, ninguna
 * portada publicada se queda en blanco.
 */
export function fondoPortada(clave: string | null | undefined, hex: string): FondoPortada {
  const color = hex || DEFAULT_COLOR;
  const vigente = normalizarPresetPortada(clave);
  const constructor = vigente ? CONSTRUCTORES[vigente] : undefined;
  if (!constructor) return { background: degradeGradient(color) };
  return constructor(color);
}
