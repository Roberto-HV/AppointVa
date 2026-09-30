// ── Fechas locales ─────────────────────────────────────────────────────────────
//
// Fuente única para los rangos "Hoy / Semana / Mes" que usan los filtros del
// dashboard. Todo se calcula con los getters locales del navegador.
//
// NUNCA derivar "YYYY-MM-DD" con `toISOString()`: convierte el instante a UTC y
// en México (UTC-6) a partir de las 18:00 locales devuelve el día siguiente, así
// que el preset "Hoy" terminaba consultando un rango futuro y vacío.

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
