// ── Colores compartidos por las landings (`/` y `/salud`) ─────────────────────
//
// Dorado de la marca: SOLO en el logo ("Va"). Acento terracota y tinta cálida
// salen de tokens (src/index.css): en /salud, data-sector="salud" los vuelve
// #0F4C75 y la rampa fría sin tocar los componentes.
export const GOLD = "#C8A961";
export const ACENTO = "rgb(var(--color-accent-brand))";
// TINTA es la tinta clara (#1F1B16): las landings son solo modo claro, así que
// --color-ink nunca se invierte aquí. Úsala también para bloques oscuros.
export const TINTA = "rgb(var(--color-ink))";
