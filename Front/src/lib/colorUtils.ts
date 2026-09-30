export const DEFAULT_COLOR = "#334155";

export function hexToChannels(hex: string): string {
  const h = (hex ?? DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

export function hexToHsl(hex: string): [number, number, number] {
  const h = (hex ?? DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return [Math.round(hue * 360), Math.round(Math.max(s, 0.45) * 100), Math.round(l * 100)];
}

export function degradeGradient(hex: string): string {
  const [hue, sat] = hexToHsl(hex);
  return `linear-gradient(to bottom, hsl(${hue},${sat}%,42%) 0%, hsl(${hue},${Math.min(sat + 12, 100)}%,9%) 100%)`;
}

// ── Rampa de tonos de marca ───────────────────────────────────────────────────
// Cada negocio elige su propio hex y la página tiene que verse bien con cualquiera.
// Aplicar alfa sobre el hex crudo no funciona: un dorado al 8% es invisible y un
// magenta al 8% grita. La rampa fija la luminosidad en lugar de mezclarla, así el
// mismo escalón se percibe igual venga de donde venga el tono.

/** HSL sin el piso de saturación de `hexToHsl`, que existe solo para el degradado. */
function hslCrudo(hex: string): [number, number, number] {
  const h = (hex || DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return [hue * 360, s * 100, l * 100];
}

function hslARgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] :
    hp < 2 ? [x, c, 0] :
    hp < 3 ? [0, c, x] :
    hp < 4 ? [0, x, c] :
    hp < 5 ? [x, 0, c] :
             [c, 0, x];
  const m = lN - c / 2;
  return [r1 + m, g1 + m, b1 + m].map((v) => Math.round(v * 255)) as [number, number, number];
}

function aHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Contraste WCAG 2.1 contra blanco. */
function contrasteSobreBlanco([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return 1.05 / (lum + 0.05);
}

const TINTE_SAT_MIN = 20;
const TINTE_SAT_MAX = 38;

/**
 * Relleno de contenedor (equivalente al tono 90–95 de Material 3): conserva el
 * matiz, fija la luminosidad y recorta la saturación para que un magenta puro y
 * un dorado apagado aterricen en la misma intensidad percibida.
 */
export function brandTint(hex: string, tono = 95): string {
  const [h, s] = hslCrudo(hex);
  const sat = Math.min(Math.max(s, TINTE_SAT_MIN), TINTE_SAT_MAX);
  return `hsl(${Math.round(h)}, ${Math.round(sat)}%, ${tono}%)`;
}

/**
 * Acento legible sobre blanco (equivalente al tono 40): anillo de selección,
 * palomita y píldoras activas. Se busca la luminosidad por contraste en vez de
 * fijarla, porque la L de HSL no es luminancia: un amarillo a L=40 sigue siendo
 * demasiado claro para llevar texto o iconos blancos.
 */
export function brandAccent(hex: string, contrasteMinimo = 4.5): string {
  const [h, s] = hslCrudo(hex);
  const sat = Math.max(s, 30);
  for (let l = 46; l >= 12; l--) {
    const rgb = hslARgb(h, sat, l);
    if (contrasteSobreBlanco(rgb) >= contrasteMinimo) return aHex(rgb);
  }
  return aHex(hslARgb(h, sat, 12));
}

/**
 * Superficie sólida que va a llevar texto blanco (el CTA). Respeta el hex de marca
 * tal cual cuando ya da contraste; solo lo oscurece cuando no, que es donde un
 * dorado o un verde salvia dejaban el botón ilegible.
 */
export function brandSolid(hex: string, contrasteMinimo = 4.5): string {
  const h = (hex || DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  return contrasteSobreBlanco(rgb) >= contrasteMinimo ? hex : brandAccent(hex, contrasteMinimo);
}
