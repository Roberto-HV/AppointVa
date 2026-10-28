import type { CSSProperties } from "react";
import { PRESETS_PORTADA } from "./portadaPresets";

// ── Velo y tinta del texto de la portada ──────────────────────────────────────
// Única fuente de lo que va entre el fondo de la portada y su texto. La usan la
// portada real del booking, la vista previa de Perfil y las muestras del
// selector: si una cambia y las otras no, el dueño elige con una promesa que el
// cliente nunca ve.
//
// Cada superficie tiene su propia geometría (en la portada el texto va abajo, en
// la vista previa arriba y en la muestra es una miniatura), así que los velos no
// son la misma cadena; lo que comparten es el modo, que sale de un solo sitio.

/**
 * Qué hay detrás del texto:
 *  · "foto": la imagen subida; puede ser blanca y pide el velo oscuro fuerte.
 *  · "material-claro": cuarzo blanco, duela de roble… Tinta oscura y, como
 *    mucho, un velo blanco muy ligero: el material se ve entero.
 *  · "material-oscuro": sus vetas claras (plata, verde agua) pueden pasar justo
 *    bajo el nombre; un velo oscuro ligero lo mantiene sobre el 4.5:1.
 *  · "fondo-marca": un fondo generado del color de marca; nace oscuro y liso
 *    donde cae el texto.
 *  · "degradado-marca": sin preset ni foto, el degradado de siempre.
 */
export type ModoPortada =
  | "foto"
  | "material-claro"
  | "material-oscuro"
  | "fondo-marca"
  | "degradado-marca";

export function modoPortada(clave: string | null | undefined, conFoto: boolean): ModoPortada {
  const preset = PRESETS_PORTADA.find((p) => p.clave === clave);
  if (!preset) return conFoto ? "foto" : "degradado-marca";
  if (preset.familia !== "material") return "fondo-marca";
  return preset.tono === "claro" ? "material-claro" : "material-oscuro";
}

// ── Velos ─────────────────────────────────────────────────────────────────────

// Portada real (texto abajo). Los tramos del velo de foto están medidos contra una
// portada blanca pura: el nombre cae alrededor del 60% y necesita ~0.80 de negro
// para llegar al 4.5:1 de la WCAG 1.4.3; arriba se desvanece hasta cero. Los
// tramos intermedios aproximan una curva suave para que el borde superior del
// velo no se lea como una banda sobre una foto plana y clara.
const PORTADA_FOTO =
  "linear-gradient(to top, rgba(12,12,15,0.86) 0%, rgba(12,12,15,0.81) 42%, " +
  "rgba(12,12,15,0.70) 60%, rgba(12,12,15,0.50) 74%, rgba(12,12,15,0.28) 85%, " +
  "rgba(12,12,15,0.11) 93%, rgba(12,12,15,0) 100%)";
// La veta más clara (plata al 85% sobre cuarzo negro) necesita ~0.4 de negro
// bajo el nombre para quedar en 4.5:1.
const PORTADA_OSCURO =
  "linear-gradient(to top, rgba(12,12,15,0.6) 0%, rgba(12,12,15,0.5) 55%, " +
  "rgba(12,12,15,0.28) 82%, rgba(12,12,15,0) 100%)";
// Material claro: la tinta oscura ya pasa el 4.5:1 sobre el tono más oscuro de
// cada material; el blanco al 35% solo apaga las vetas y juntas que crucen el
// texto (una junta de duela bajo una letra baja de 3.2:1 a 6.5:1).
const PORTADA_CLARO =
  "linear-gradient(to top, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.3) 60%, " +
  "rgba(255,255,255,0) 100%)";

// Vista previa de Perfil (texto arriba, maqueta de 64 px). Sobre una foto blanca
// —el peor caso— el tramo que cubre el texto deja el nombre en 12.7:1 y la
// descripción en 6.2:1.
const PREVIA_FOTO =
  "linear-gradient(to bottom, rgba(12,12,15,0.86) 0%, rgba(12,12,15,0.84) 50%, " +
  "rgba(12,12,15,0.70) 74%, rgba(12,12,15,0.38) 88%, rgba(12,12,15,0.12) 100%)";
// El degradado de marca solo necesita que no queme arriba: lo justo para pasar el
// 4.5:1 con margen sin apagar el color que el negocio está eligiendo.
const PREVIA_MARCA =
  "linear-gradient(to bottom, rgba(12,12,15,0.42) 0%, rgba(12,12,15,0.22) 70%, rgba(12,12,15,0) 100%)";
const PREVIA_CLARO =
  "linear-gradient(to bottom, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.3) 74%, " +
  "rgba(255,255,255,0.1) 100%)";

// Muestras del selector: la misma idea comprimida en una miniatura.
const MUESTRA_FOTO =
  "linear-gradient(to top, rgba(12,12,15,0.8) 0%, rgba(12,12,15,0.55) 40%, rgba(12,12,15,0) 75%)";
const MUESTRA_OSCURO =
  "linear-gradient(to top, rgba(12,12,15,0.55) 0%, rgba(12,12,15,0.3) 40%, rgba(12,12,15,0) 75%)";
const MUESTRA_CLARO =
  "linear-gradient(to top, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0) 75%)";

export interface VelosPortada {
  /** Bloque de texto de la portada del booking. */
  portada: string | null;
  /** Vista previa del encabezado en Perfil. */
  vistaPrevia: string | null;
  /** Miniatura del selector de fondos. */
  muestra: string | null;
}

export const VELOS_PORTADA: Record<ModoPortada, VelosPortada> = {
  foto: { portada: PORTADA_FOTO, vistaPrevia: PREVIA_FOTO, muestra: MUESTRA_FOTO },
  "material-claro": { portada: PORTADA_CLARO, vistaPrevia: PREVIA_CLARO, muestra: MUESTRA_CLARO },
  // En la maqueta de 64 px el velo ligero de marca basta para las vetas claras.
  "material-oscuro": { portada: PORTADA_OSCURO, vistaPrevia: PREVIA_MARCA, muestra: MUESTRA_OSCURO },
  // Taparlo mentiría sobre cómo se ve el fondo elegido: ya nace oscuro, incluso
  // comprimido en 64 px (el peor caso medido es 6.2:1).
  "fondo-marca": { portada: null, vistaPrevia: null, muestra: null },
  // En la portada real el texto cae en el extremo oscuro del degradado; en la
  // maqueta cae en el claro —un dorado da 4.2:1— y pide un velo ligero.
  "degradado-marca": { portada: null, vistaPrevia: PREVIA_MARCA, muestra: null },
};

// ── Tinta ─────────────────────────────────────────────────────────────────────

/**
 * Colores del texto y los controles que van sobre la portada. Las clases son las
 * de la paleta slate de Tailwind, no hex sueltos. La tinta clara conserva los
 * valores de siempre en línea para que foto, marca y materiales oscuros no
 * cambien ni un píxel.
 */
export interface TintaPortada {
  /** "oscura" sobre materiales claros; "clara" en todo lo demás. */
  tipo: "clara" | "oscura";
  titulo: { className: string; style: CSSProperties };
  descripcion: { className: string; style: CSSProperties };
  secundario: { className: string; style: CSSProperties };
  /** Píldora de calificación. */
  pildora: string;
  pildoraTexto: string;
  /** Monograma cuando no hay logo. */
  monograma: string;
  /** Clase del borde del logo/monograma; vacía = se usa el color de marca en línea. */
  bordeLogo: string;
  /** Anillo de foco visible sobre este fondo. */
  anilloFoco: string;
  /** Barras de la muestra del selector: [nombre, descripción]. */
  muestra: [{ className?: string; style?: CSSProperties }, { className?: string; style?: CSSProperties }];
}

// Piso de legibilidad sobre foto: el velo sostiene el contraste en conjunto, pero
// una zona clara aislada puede colarse bajo una línea.
const SOMBRA_CLARA = "0 1px 3px rgba(12,12,15,0.65)";
// Sobre material claro la sombra es un halo blanco: separa la letra de una veta.
const SOMBRA_OSCURA = "0 1px 2px rgba(255,255,255,0.6)";

const TINTA_CLARA: TintaPortada = {
  tipo: "clara",
  titulo: { className: "text-white", style: { textShadow: SOMBRA_CLARA } },
  descripcion: { className: "", style: { color: "rgba(255,255,255,0.92)", textShadow: SOMBRA_CLARA } },
  secundario: { className: "", style: { color: "rgba(255,255,255,0.80)", textShadow: SOMBRA_CLARA } },
  pildora: "bg-ink/40",
  pildoraTexto: "text-white/85",
  monograma: "text-white",
  bordeLogo: "",
  anilloFoco: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
  muestra: [
    { style: { background: "rgba(255,255,255,0.92)" } },
    { style: { background: "rgba(255,255,255,0.55)" } },
  ],
};

const TINTA_OSCURA: TintaPortada = {
  tipo: "oscura",
  titulo: { className: "text-slate-900", style: { textShadow: SOMBRA_OSCURA } },
  descripcion: { className: "text-slate-800", style: { textShadow: SOMBRA_OSCURA } },
  secundario: { className: "text-slate-800", style: { textShadow: SOMBRA_OSCURA } },
  pildora: "bg-white/70",
  pildoraTexto: "text-slate-800",
  monograma: "text-slate-900",
  bordeLogo: "border-slate-900/25",
  anilloFoco: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900",
  muestra: [{ className: "bg-slate-900/90" }, { className: "bg-slate-900/55" }],
};

export function tintaPortada(modo: ModoPortada): TintaPortada {
  return modo === "material-claro" ? TINTA_OSCURA : TINTA_CLARA;
}
