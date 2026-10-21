// ── Distribución de citas en una rejilla de horas ────────────────────────────
//
// El calendario dibujaba cada cita a todo el ancho de su día: dos citas a la
// misma hora (dos profesionales, sin filtro) quedaban una encima de otra y solo
// la de arriba se podía tocar. Y el rango fijo 7:00–21:00 recortaba las citas
// fuera de él (una de 6:30 aparecía a las 7:00; una de 21:30 no aparecía).

interface CitaEnRejilla {
  id: string;
  inicioEn: string;
  duracionMinutos: number;
}

export interface Carril {
  /** Columna de la cita dentro de su grupo de solapes (0 = la primera). */
  carril: number;
  /** Columnas que necesita su grupo de solapes. */
  carriles: number;
}

const inicioMs = (c: CitaEnRejilla) => new Date(c.inicioEn).getTime();
const finMs = (c: CitaEnRejilla) => inicioMs(c) + c.duracionMinutos * 60_000;

/** Asigna a cada cita una columna para que las que se solapan queden lado a lado. */
export function asignarCarriles(citas: CitaEnRejilla[]): Map<string, Carril> {
  const resultado = new Map<string, Carril>();
  const ordenadas = [...citas].sort((a, b) => inicioMs(a) - inicioMs(b) || finMs(b) - finMs(a));

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
 * primera y la última cita. Devuelve horas enteras [inicio, fin).
 */
export function rangoHoras(citas: CitaEnRejilla[], base: [number, number] = [7, 21]): { inicio: number; fin: number } {
  let [inicio, fin] = base;
  for (const c of citas) {
    const d = new Date(c.inicioEn);
    const horaIni = d.getHours() + d.getMinutes() / 60;
    const horaFin = horaIni + c.duracionMinutos / 60;
    inicio = Math.min(inicio, Math.floor(horaIni));
    fin = Math.max(fin, Math.min(24, Math.ceil(horaFin)));
  }
  return { inicio: Math.max(0, inicio), fin };
}
