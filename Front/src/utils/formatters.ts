// ── Precio ─────────────────────────────────────────────────────────────────────
export function formatPrecio(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/**
 * Precio compacto para tiles estrechos y ejes de gráfica: "$1,250", "$12k".
 * Con separador de miles, igual que `formatPrecio`, pero sin centavos.
 */
export function formatPrecioCorto(n: number): string {
  if (n >= 10000) return `$${Math.round(n / 1000).toLocaleString("es-MX")}k`;
  return `$${Math.round(n).toLocaleString("es-MX")}`;
}

// ── Texto ──────────────────────────────────────────────────────────────────────

/**
 * Mayúscula solo en la primera letra: "miércoles, 21 de octubre" → "Miércoles, 21 de octubre".
 * En español los meses, los días y "de" van en minúscula, así que las fechas
 * no deben pasar por `capitalize` de CSS (que pondría "21 De Octubre").
 */
export function capitalizarPrimera(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("es-MX") + texto.slice(1);
}

// ── Date parsing ───────────────────────────────────────────────────────────────
// The backend sends naive local datetimes without timezone suffix.
// JS parses strings without a timezone qualifier as local time (ES2015+),
// which is exactly what we want — do NOT append 'Z'.
export function toUtcDate(iso: string): Date {
  return new Date(iso);
}

// ── Fecha sola ─────────────────────────────────────────────────────────────────

/** Solo fecha, sin hora: "15 de junio de 2026" */
export function formatFecha(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  }).replace(/\bDe\b/g, "de");
}

/** Fecha numérica para comprobantes y tablas de admin: "15/06/2026" */
export function formatFechaMx(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Fecha con día de semana completo, sin hora: "Martes, 15 de junio de 2026" */
export function formatFechaLarga(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).replace(/\bDe\b/g, "de");
  return capitalizarPrimera(s);
}

// ── Fecha y hora ───────────────────────────────────────────────────────────────

/** Fecha + hora compacta para tablas: "15 jun 2026, 10:00 a. m." */
export function formatFechaHoraCorta(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/** Solo la parte de fecha corta: "14 sep 2026" */
export function formatFechaCorta(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** Solo la parte de hora: "04:30 p. m." */
export function formatHora(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Fecha + hora estándar para vistas detalle: "15 de junio de 2026, 10:00 a. m." */
export function formatFechaHora(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
}

/** Fecha + hora con día de semana abreviado para dashboards: "Mar. 15 de junio..." */
export function formatFechaHoraResumen(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
  return capitalizarPrimera(s);
}

/** Fecha + hora completa para comprobantes: "Martes, 15 de junio de 2026..." */
export function formatFechaHoraCompleta(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
  return capitalizarPrimera(s);
}
