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
