// ── Fechas locales ─────────────────────────────────────────────────────────────
//
// Fuente única para los rangos "Hoy / Semana / Mes" que usan los filtros del
// dashboard. Todo se calcula con los getters locales del navegador.
//
// NUNCA derivar "YYYY-MM-DD" con `toISOString()`: convierte el instante a UTC y
// en México (UTC-6) a partir de las 18:00 locales devuelve el día siguiente, así
// que el preset "Hoy" terminaba consultando un rango futuro y vacío.

/**
 * Nombres de los periodos en todo el panel: Inicio, Citas, Pagos y Reportes.
 * Antes unas pantallas decían "Semana / Mes" y otras "Esta semana / Este mes"
 * para lo mismo. Son periodos de calendario (lunes a domingo, día 1 al último),
 * no ventanas móviles de 7 o 30 días, y el nombre lo dice.
 */
export const NOMBRE_PERIODO = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
  anio: "Este año",
} as const;

/** Convierte un Date a "YYYY-MM-DD" respetando la zona horaria local. */
export function fechaLocal(d: Date): string {
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Fecha de hoy: "2026-09-30" */
export function hoy(base: Date = new Date()): string {
  return fechaLocal(base);
}

/** Lunes de la semana en curso. */
export function inicioSemana(base: Date = new Date()): string {
  const diasDesdeLunes = base.getDay() === 0 ? 6 : base.getDay() - 1;
  return fechaLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate() - diasDesdeLunes));
}

/** Domingo de la semana en curso. */
export function finSemana(base: Date = new Date()): string {
  const diasHastaDomingo = base.getDay() === 0 ? 0 : 7 - base.getDay();
  return fechaLocal(new Date(base.getFullYear(), base.getMonth(), base.getDate() + diasHastaDomingo));
}

/** Primer día del mes en curso. */
export function inicioMes(base: Date = new Date()): string {
  return fechaLocal(new Date(base.getFullYear(), base.getMonth(), 1));
}

/** Último día del mes en curso. */
export function finMes(base: Date = new Date()): string {
  // El día 0 del mes siguiente es el último del mes actual.
  return fechaLocal(new Date(base.getFullYear(), base.getMonth() + 1, 0));
}

/** Primer día del año en curso. */
export function inicioAnio(base: Date = new Date()): string {
  return fechaLocal(new Date(base.getFullYear(), 0, 1));
}

/** Último día del año en curso. */
export function finAnio(base: Date = new Date()): string {
  return fechaLocal(new Date(base.getFullYear(), 11, 31));
}

/**
 * Marca como UTC un ISO que llega sin zona ("2026-10-21T15:00:00"). El backend
 * guarda los bloqueos en UTC; sin la "Z" el navegador lo leería como hora local.
 */
export function comoUtc(iso: string): string {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
}

/** Día local (a medianoche) de un instante ISO: para exportar "última visita" como fecha sin hora. */
export function soloFecha(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * "YYYY-MM-DD" → Date local. `new Date("2026-10-01")` lo lee como medianoche
 * UTC, que en México es el día anterior a las 18:00.
 */
export function deFechaLocal(ymd: string): Date {
  const [anio, mes, dia] = ymd.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

/** "2026-10-01" → "01 de octubre de 2026", sin desfase por zona horaria. */
export function fechaLargaLocal(ymd: string): string {
  return deFechaLocal(ymd).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}

/** Desfase (ms) de la zona `zona` respecto a UTC en el instante `instante`. */
function desfaseZona(instante: number, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instante));
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second")) - instante;
}

/**
 * Último segundo del día "YYYY-MM-DD" en la zona horaria del negocio, como ISO
 * UTC. Un cupón "válido hasta el 31" mandado como fecha sola vencía a las 00:00
 * UTC, es decir, la tarde del 30 en México. Sin zona válida usa la del navegador.
 */
export function finDelDiaEnZona(ymd: string, zona?: string | null): string {
  const [anio, mes, dia] = ymd.split("-").map(Number);
  const pared = Date.UTC(anio, mes - 1, dia, 23, 59, 59);
  try {
    if (!zona) throw new Error("sin zona");
    // Dos pasadas: la primera estima con el desfase de la hora "de pared" y la
    // segunda corrige si ese día hay cambio de horario.
    let instante = pared - desfaseZona(pared, zona);
    instante = pared - desfaseZona(instante, zona);
    return new Date(instante).toISOString();
  } catch {
    return new Date(anio, mes - 1, dia, 23, 59, 59).toISOString();
  }
}

/**
 * Día "YYYY-MM-DD" de un instante ISO en la zona del negocio: el inverso de
 * `finDelDiaEnZona` para precargar la fecha de un cupón al editarlo. Sin zona
 * válida usa la del navegador.
 */
export function fechaEnZona(iso: string, zona?: string | null): string {
  const d = new Date(comoUtc(iso));
  try {
    if (!zona) throw new Error("sin zona");
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d);
    const v = (t: string) => partes.find((p) => p.type === t)?.value;
    return `${v("year")}-${v("month")}-${v("day")}`;
  } catch {
    return fechaLocal(d);
  }
}

/**
 * Días de calendario ("AAAA-MM-DD", hora local del admin) a instantes UTC para
 * `GET /admin/audit` (B24): `desde` es el inicio de ese día y `hasta` el inicio
 * del día siguiente, porque el servidor lo trata como límite exclusivo.
 */
export function rangoAuditoria(desde: string, hasta: string): { desde?: string; hasta?: string } {
  const inicioDia = (dia: string, sumarDias = 0) => {
    const [a, m, d] = dia.split("-").map(Number);
    return new Date(a, m - 1, d + sumarDias).toISOString();
  };
  return {
    desde: desde ? inicioDia(desde) : undefined,
    hasta: hasta ? inicioDia(hasta, 1) : undefined,
  };
}
