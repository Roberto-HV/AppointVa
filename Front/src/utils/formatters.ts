// ── Precio ─────────────────────────────────────────────────────────────────────
export function formatPrecio(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

// ── UTC normalization ──────────────────────────────────────────────────────────
// Npgsql.EnableLegacyTimestampBehavior omits the 'Z' suffix on UTC datetimes.
// Without it, JS parses bare ISO datetimes as local time, shifting all times by
// the user's UTC offset. Append 'Z' when the string has a time component but no
// timezone qualifier already present.
export function toUtcDate(iso: string): Date {
  if (iso.includes('T') && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso + 'Z');
  }
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

/** Fecha con día de semana completo, sin hora: "Martes, 15 de junio de 2026" */
export function formatFechaLarga(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).replace(/\bDe\b/g, "de");
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fecha + hora completa para comprobantes: "Martes, 15 de junio de 2026..." */
export function formatFechaHoraCompleta(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
