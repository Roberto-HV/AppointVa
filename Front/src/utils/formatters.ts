// ── Precio ─────────────────────────────────────────────────────────────────────
/** Pesos enteros sin centavos ("$280"); con centavos solo si los hay ("$280.50"). */
export function formatPrecio(n: number): string {
  const enteros = Number.isInteger(n);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: enteros ? 0 : 2,
    maximumFractionDigits: enteros ? 0 : 2,
  }).format(n);
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
    ...OPCIONES_HORA,
  });
}

/** Solo la parte de fecha corta: "14 sep 2026" */
export function formatFechaCorta(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// Formato único de hora en toda la app: "9:00 a. m." (hora sin cero a la izquierda).
const OPCIONES_HORA = { hour: "numeric", minute: "2-digit", hour12: true } as const;

/** Hora de un Date: "4:30 p. m." */
export function formatHoraDe(d: Date): string {
  return d.toLocaleTimeString("es-MX", OPCIONES_HORA);
}

/** Solo la parte de hora: "4:30 p. m." */
export function formatHora(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return formatHoraDe(d);
}

/**
 * Cuándo es una cita, dicho como en una conversación: "hoy a las 9:00 a. m.",
 * "mañana a la 1:00 p. m.", "el jueves 22 a las 5:30 p. m." (dentro de la
 * semana) o "el jueves 22 de octubre a las …" (más lejos; con año si no es
 * el actual). Lo usa el titular de la confirmación ("Te esperamos …").
 */
export function formatCuandoCita(iso: string, ahora: Date = new Date()): string {
  return describirCuandoCita(iso, ahora)?.texto ?? "";
}

/** `formatCuandoCita` con los datos para decidir el tono de la frase sin parsear el texto. */
export interface CuandoCita {
  texto: string;
  /** Días de calendario local desde hoy: 0 = hoy, 1 = mañana, negativo = ya pasó. */
  dias: number;
  /** La hora de inicio ya llegó respecto de `ahora`. */
  yaInicio: boolean;
}

export function describirCuandoCita(iso: string, ahora: Date = new Date()): CuandoCita | null {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return null;
  const aLasHora = formatALasHora(d);
  const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  const diaCita = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((diaCita - hoyInicio) / 86_400_000);
  const yaInicio = d.getTime() <= ahora.getTime();
  if (dias === 0) return { texto: `hoy ${aLasHora}`, dias, yaInicio };
  if (dias === 1) return { texto: `mañana ${aLasHora}`, dias, yaInicio };
  const cerca = dias > 1 && dias < 7;
  const fecha = d
    .toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      ...(cerca ? {} : { month: "long" }),
      ...(!cerca && d.getFullYear() !== ahora.getFullYear() ? { year: "numeric" } : {}),
    })
    .replace(/,/g, "")
    .replace(/\bDe\b/g, "de");
  return { texto: `el ${fecha} ${aLasHora}`, dias, yaInicio };
}

/** "a las 5:30 p. m.", y "a la 1:00 p. m." para la una: el artículo concuerda con la hora. */
export function formatALasHora(d: Date): string {
  return `${d.getHours() % 12 === 1 ? "a la" : "a las"} ${formatHoraDe(d)}`;
}

/** Fecha + hora estándar para vistas detalle: "15 de junio de 2026, 10:00 a. m." */
export function formatFechaHora(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
    ...OPCIONES_HORA,
  }).replace(/\bDe\b/g, "de");
}

/** Fecha + hora con día de semana abreviado para dashboards: "Mar. 15 de junio..." */
export function formatFechaHoraResumen(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    ...OPCIONES_HORA,
  }).replace(/\bDe\b/g, "de");
  return capitalizarPrimera(s);
}

/** Fecha + hora completa para comprobantes: "Martes, 15 de junio de 2026..." */
export function formatFechaHoraCompleta(iso: string): string {
  const d = toUtcDate(iso);
  if (isNaN(d.getTime())) return "—";
  const s = d.toLocaleString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    ...OPCIONES_HORA,
  }).replace(/\bDe\b/g, "de");
  return capitalizarPrimera(s);
}

// Partículas de apellidos compuestos ("de la Cruz", "del Valle", "y Gasset").
const PARTICULAS_APELLIDO = new Set(["de", "del", "la", "las", "los", "y"]);

/**
 * Nombre de pila + inicial del apellido: "María García López" → "María G.",
 * "María de la Cruz" → "María C." (salta partículas).
 * Lo usa el modo recepción, que se ve desde la sala de espera (decisión 12, DC-28).
 */
export function nombreConInicial(nombreCompleto: string | null | undefined): string {
  const partes = (nombreCompleto ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  // Limitación: no distingue nombres de pila compuestos ("Juan Carlos Pérez"
  // da "Juan C."); toma siempre la primera palabra como nombre.
  const apellido = partes.slice(1).find((p) => !PARTICULAS_APELLIDO.has(p.toLocaleLowerCase("es-MX")));
  if (!apellido) return partes[0];
  return `${partes[0]} ${apellido.charAt(0).toLocaleUpperCase("es-MX")}.`;
}

// Palabras genéricas del giro que no distinguen a un negocio de otro.
const GIROS_GENERICOS = new Set([
  "salon", "barberia", "clinica", "consultorio", "estudio", "spa",
  "el", "la", "los", "las", "de", "del", "y",
]);

/** Sin acentos y en minúsculas, para comparar con GIROS_GENERICOS. */
function normalizar(palabra: string): string {
  return palabra.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX");
}

/**
 * Monograma del negocio a partir de su palabra distintiva:
 * "Salón Aramis" → "A", "Barbería Luis" → "L", "Clínica Dental Sonrisa" → "D".
 * Si todas las palabras son genéricas, usa la primera ("Salón" → "S").
 */
export function monogramaNegocio(nombre: string | null | undefined): string {
  const palabras = (nombre ?? "").trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "";
  const distintiva = palabras.find((p) => !GIROS_GENERICOS.has(normalizar(p))) ?? palabras[0];
  return distintiva.charAt(0).toLocaleUpperCase("es-MX");
}
