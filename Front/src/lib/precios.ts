// ── Precios de los planes en las landings ─────────────────────────────────────
//
// El interruptor "Mensual / Anual" afecta a todas las tarjetas a la vez. Un plan
// sin precio anual no puede seguir mostrando su precio como si nada hubiera
// cambiado: se marca explícitamente como "sin descuento anual" (AP-08).

export interface PrecioPlan {
  /** Precio por mes con facturación mensual. */
  mensual: number;
  /** Precio por mes con facturación anual. Sin valor = el plan no tiene precio anual. */
  anual?: number;
  /**
   * `false` para un plan "Próximamente": no se puede contratar, así que no se
   * le pone ninguna nota de facturación ("Sin descuento anual…").
   */
  disponible?: boolean;
}

export interface PrecioVisible {
  /** Precio por mes que se muestra en la tarjeta. */
  porMes: number;
  /** El precio mostrado es el anual (con descuento). */
  facturaAnual: boolean;
  /** Se eligió "Anual", pero este plan no tiene precio anual. */
  sinPrecioAnual: boolean;
  /** Ahorro por año frente a pagar mes a mes (0 si no aplica). */
  ahorroAnual: number;
}

export function precioVisible(plan: PrecioPlan, anualSeleccionado: boolean): PrecioVisible {
  const tieneAnual = typeof plan.anual === "number" && plan.anual > 0 && plan.anual < plan.mensual;
  if (anualSeleccionado && tieneAnual) {
    return {
      porMes: plan.anual!,
      facturaAnual: true,
      sinPrecioAnual: false,
      ahorroAnual: (plan.mensual - plan.anual!) * 12,
    };
  }
  return {
    porMes: plan.mensual,
    facturaAnual: false,
    sinPrecioAnual: anualSeleccionado && !tieneAnual && plan.disponible !== false,
    ahorroAnual: 0,
  };
}

/** Monto sin decimales con separadores de miles de México: 1,234. */
export function formatMonto(n: number): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
}
