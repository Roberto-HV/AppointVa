export const DEFAULT_COLOR = "#334155";

export function hexToChannels(hex: string): string {
  const h = (hex ?? DEFAULT_COLOR).replace("#", "").padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}
