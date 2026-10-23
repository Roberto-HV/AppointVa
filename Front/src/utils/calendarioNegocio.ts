// ── Calendario público del negocio ─────────────────────────────────────────────
//
// Decide si un día está cerrado a partir del horario semanal y los días bloqueados
// que publica el negocio, sin consultar disponibilidad: un día sin horarios libres
// no es lo mismo que un día en que el negocio no abre.

import type { IntervaloHorarioPublico } from "../types";

export interface CalendarioNegocio {
  horario: IntervaloHorarioPublico[];
  /** "YYYY-MM-DD" bloqueados por el negocio (feriados, cierres). */
  diasCerrados?: string[];
  /** Zona IANA del negocio; sin ella se usa la hora local del navegador. */
  zonaHoraria?: string | null;
}

/** "cerrado": no abre ese día. "cerrado-hoy": hoy, ya pasó la hora de cierre. */
export type CierreDia = "cerrado" | "cerrado-hoy";

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Fecha y minuto del día de `ahora` en la zona del negocio (o la local si no es válida). */
export function ahoraEnZona(ahora: Date, zonaHoraria?: string | null): { fecha: string; minutos: number } {
  if (zonaHoraria) {
    try {
      const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: zonaHoraria,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
      }).formatToParts(ahora);
      const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
      return { fecha: `${v("year")}-${v("month")}-${v("day")}`, minutos: Number(v("hour")) * 60 + Number(v("minute")) };
    } catch {
      // Zona desconocida para el navegador: se cae a la hora local.
    }
  }
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return { fecha: `${ahora.getFullYear()}-${mes}-${dia}`, minutos: ahora.getHours() * 60 + ahora.getMinutes() };
}

/** null cuando el negocio abre ese día (aunque luego no queden horarios libres). */
export function cierreDelDia(fecha: string, calendario: CalendarioNegocio, ahora: Date = new Date()): CierreDia | null {
  if (calendario.diasCerrados?.includes(fecha)) return "cerrado";

  const [a, m, d] = fecha.split("-").map(Number);
  const diaSemana = new Date(a, m - 1, d).getDay(); // 0=domingo, igual que el backend
  const intervalos = calendario.horario.filter((h) => h.diaSemana === diaSemana);
  if (intervalos.length === 0) return "cerrado";

  const actual = ahoraEnZona(ahora, calendario.zonaHoraria);
  if (fecha === actual.fecha) {
    const cierre = Math.max(...intervalos.map((h) => minutos(h.horaFin)));
    if (actual.minutos >= cierre) return "cerrado-hoy";
  }
  return null;
}
