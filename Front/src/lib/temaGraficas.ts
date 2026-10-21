// ── Tema de las gráficas (recharts) ────────────────────────────────────────────
//
// Colores desde los tokens del tema, para que ejes, rejilla y tooltip cambien con
// el modo oscuro. Una medida = una sola serie en el color primario (slate): un
// color distinto por barra no codificaba nada. El dorado de marca es solo para
// el logo.

/** Relleno de una serie única. */
export const COLOR_SERIE = "hsl(var(--primary))";

/**
 * Paleta categórica documentada (`--categoria-1…8`, DC-20): solo donde las
 * series o las personas se distinguen entre sí (dos series, métodos de pago,
 * avatares de empleados). No codifica estados de cita.
 */
export const COLORES_CATEGORIA = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `var(--categoria-${n})`);

/** Texto sobre un color categórico: blanco en claro, slate-950 en oscuro (≥ 4.5:1). */
export const TEXTO_SOBRE_CATEGORIA = "text-white dark:text-slate-950";

/** Color estable para el elemento `i` (da la vuelta tras el 8). */
export function colorCategoria(i: number): string {
  const n = COLORES_CATEGORIA.length;
  return COLORES_CATEGORIA[((i % n) + n) % n];
}

export const EJE_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
export const EJE_LINEA = { stroke: "hsl(var(--border))" } as const;
export const REJILLA = { stroke: "hsl(var(--border))", strokeDasharray: "3 3" } as const;

export const TOOLTIP = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 600 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted))" },
} as const;
