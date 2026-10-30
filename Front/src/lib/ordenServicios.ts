import type { ServicioDto } from "../types";

export interface CambioOrden {
  servicio: ServicioDto;
  orden: number;
}

/**
 * Cambios de `orden` para mover un servicio dentro de su categoría (M11).
 *
 * `items` es la categoría completa en el orden en que se ve. Se reparten los
 * mismos valores de `orden` que ya usa la categoría, ordenados, entre la nueva
 * secuencia: así la categoría no cambia de lugar respecto a las demás (el
 * catálogo se agrupa por la primera aparición). Si había valores repetidos
 * (todos en 1, el valor por defecto de antes), se numera desde el menor.
 * Solo se devuelven los servicios cuyo `orden` cambia: un PUT por cada uno.
 */
export function cambiosDeOrden(items: ServicioDto[], desde: number, hacia: number): CambioOrden[] {
  if (desde === hacia || desde < 0 || hacia < 0 || desde >= items.length || hacia >= items.length) return [];
  const nuevos = [...items];
  const [movido] = nuevos.splice(desde, 1);
  nuevos.splice(hacia, 0, movido);

  const valores = items.map((s) => s.orden).sort((a, b) => a - b);
  const sinRepetir = valores.every((v, i) => i === 0 || v > valores[i - 1]);
  const minimo = Math.max(1, valores[0] ?? 1);
  const ranuras = sinRepetir ? valores : nuevos.map((_, i) => minimo + i);

  return nuevos
    .map((servicio, i) => ({ servicio, orden: ranuras[i] }))
    .filter((c) => c.servicio.orden !== c.orden);
}

/** Aplica los cambios a la lista completa y la vuelve a ordenar, como la devuelve la API. */
export function aplicarOrden(servicios: ServicioDto[], cambios: CambioOrden[]): ServicioDto[] {
  const porId = new Map(cambios.map((c) => [c.servicio.id, c.orden]));
  return servicios
    .map((s) => (porId.has(s.id) ? { ...s, orden: porId.get(s.id)! } : s))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.orden - b.s.orden || a.i - b.i)
    .map(({ s }) => s);
}
