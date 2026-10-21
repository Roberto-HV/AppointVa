import type { DescuentoValidado } from "../api/descuentos";

/** Precio tras aplicar un código; nunca negativo y redondeado a centavos. */
export function precioConDescuento(
  precio: number,
  descuento: Pick<DescuentoValidado, "tipo" | "valor">
): number {
  const final = descuento.tipo === "Porcentaje"
    ? precio * (1 - descuento.valor / 100)
    : precio - descuento.valor;
  return Math.max(0, Math.round(final * 100) / 100);
}
