// ── Tema de las gráficas (recharts) ────────────────────────────────────────────
//
// Colores desde los tokens del tema, para que ejes, rejilla y tooltip cambien con
// el modo oscuro. Una medida = una sola serie en el color primario (slate): un
// color distinto por barra no codificaba nada. El dorado de marca es solo para
// el logo.

/** Relleno de una serie única. */
export const COLOR_SERIE = "hsl(var(--primary))";

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
