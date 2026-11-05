// ── Colores compartidos por las landings (`/` y `/salud`) ─────────────────────
//
// El dorado es el color principal de AppointVa: además del logo, marca los
// acentos de las zonas oscuras ("Sin llamadas.", el plan destacado, la luz del
// hero). Nunca como texto sobre fondo claro: ahí no llega a 4.5:1 y el texto va
// en azul marino. Acento y tinta azul marino salen de tokens (src/index.css): en
// /salud, data-sector="salud" vuelve el acento #0F4C75 y la rampa fría sin tocar
// los componentes.
export const GOLD = "#C8A961";
// Dorado del "Va" tal como se ve en `logo-appointva-oscuro.png` (promedio de sus
// píxeles). GOLD es más apagado y junto al logo se nota la diferencia, así que
// los acentos de la landing usan este. Sobre el azul marino da ≈9:1.
export const ORO_LOGO = "#EEB114";
/** El mismo dorado en canales RGB, para `rgb(${ORO_LOGO_RGB} / alfa)`. */
export const ORO_LOGO_RGB = "238 177 20";
export const ACENTO = "rgb(var(--color-accent-brand))";
// TINTA es la tinta azul marino (#1E293B): las landings son solo modo claro, así que
// --color-ink nunca se invierte aquí. Úsala también para bloques oscuros.
export const TINTA = "rgb(var(--color-ink))";
