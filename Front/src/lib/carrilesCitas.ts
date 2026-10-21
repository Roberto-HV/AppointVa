// ── Distribución de citas en una rejilla de horas ────────────────────────────
//
// El calendario dibujaba cada cita a todo el ancho de su día: dos citas a la
// misma hora (dos profesionales, sin filtro) quedaban una encima de otra y solo
// la de arriba se podía tocar. Y el rango fijo 7:00–21:00 recortaba las citas
// fuera de él (una de 6:30 aparecía a las 7:00; una de 21:30 no aparecía).

//
// Las citas canceladas o con inasistencia ya no ocupan la agenda: no toman
// carril (una cancelada no estrecha a la activa que la reemplazó) ni amplían
// las horas visibles. Se dibujan detrás, atenuadas y a todo el ancho.

interface CitaEnRejilla {
  id: string;
  inicioEn: string;
  duracionMinutos: number;
  estadoTexto?: string;
}

export interface Carril {
  /** Columna de la cita dentro de su grupo de solapes (0 = la primera). */
  carril: number;
  /** Columnas que necesita su grupo de solapes. */
  carriles: number;
  /** Cita que ya no ocupa la agenda: se dibuja detrás y atenuada. */
  deFondo?: boolean;
}

const ESTADOS_SIN_OCUPACION = new Set(["Cancelada", "Inasistencia"]);

/** La cita sigue ocupando su hueco en la agenda (no está cancelada ni marcada como inasistencia). */
export function ocupaAgenda(c: { estadoTexto?: string }): boolean {
  return !ESTADOS_SIN_OCUPACION.has(c.estadoTexto ?? "");
}

const inicioMs = (c: CitaEnRejilla) => new Date(c.inicioEn).getTime();
const finMs = (c: CitaEnRejilla) => inicioMs(c) + c.duracionMinutos * 60_000;

/** Asigna a cada cita una columna para que las que se solapan queden lado a lado. */
export function asignarCarriles(citas: CitaEnRejilla[]): Map<string, Carril> {
  const resultado = new Map<string, Carril>();
  for (const c of citas) {
    if (!ocupaAgenda(c)) resultado.set(c.id, { carril: 0, carriles: 1, deFondo: true });
  }
  const ordenadas = citas.filter(ocupaAgenda).sort((a, b) => inicioMs(a) - inicioMs(b) || finMs(b) - finMs(a));

  let grupo: { id: string; carril: number }[] = [];
  let finesPorCarril: number[] = [];
  let finGrupo = -Infinity;

  const cerrarGrupo = () => {
    for (const g of grupo) resultado.set(g.id, { carril: g.carril, carriles: finesPorCarril.length });
    grupo = [];
    finesPorCarril = [];
  };

  for (const c of ordenadas) {
    const ini = inicioMs(c);
    if (ini >= finGrupo) cerrarGrupo();
    let carril = finesPorCarril.findIndex((fin) => fin <= ini);
    if (carril === -1) {
      carril = finesPorCarril.length;
      finesPorCarril.push(finMs(c));
    } else {
      finesPorCarril[carril] = finMs(c);
    }
    grupo.push({ id: c.id, carril });
    finGrupo = Math.max(finGrupo, finMs(c));
  }
  cerrarGrupo();
  return resultado;
}

/**
 * Horas visibles de la rejilla: el rango base, ampliado para que quepan la
 * primera y la última cita que ocupan la agenda. Devuelve horas enteras [inicio, fin).
 */
export function rangoHoras(citas: CitaEnRejilla[], base: [number, number] = [7, 21]): { inicio: number; fin: number } {
  let [inicio, fin] = base;
  for (const c of citas) {
    if (!ocupaAgenda(c)) continue;
    const d = new Date(c.inicioEn);
    const horaIni = d.getHours() + d.getMinutes() / 60;
    const horaFin = horaIni + c.duracionMinutos / 60;
    inicio = Math.min(inicio, Math.floor(horaIni));
    fin = Math.max(fin, Math.min(24, Math.ceil(horaFin)));
  }
  return { inicio: Math.max(0, inicio), fin };
}

/** La cita cae (al menos en parte) dentro de las horas visibles. */
export function dentroDelRango(c: CitaEnRejilla, rango: { inicio: number; fin: number }): boolean {
  const d = new Date(c.inicioEn);
  const horaIni = d.getHours() + d.getMinutes() / 60;
  const horaFin = horaIni + c.duracionMinutos / 60;
  return horaFin > rango.inicio && horaIni < rango.fin;
}
