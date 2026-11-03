/** Hasta dos iniciales del nombre completo para el avatar ("?" sin nombre). */
export function inicialesDe(nombreCompleto: string | null | undefined): string {
  const iniciales = (nombreCompleto ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return iniciales || "?";
}
