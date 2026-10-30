// ── Parámetros de URL de la lista de citas ─────────────────────────────────────
//
// La URL es editable a mano y llega de enlaces externos, así que cada valor se
// valida antes de usarse: un valor inválido toma el de por defecto y se marca
// para borrarlo de la URL (no se manda basura a la API ni se queda en la barra).

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tope de página mientras no se conoce el total (evita `pagina=1e308`). */
export const PAGINA_MAXIMA = 10_000;

/** "YYYY-MM-DD" que además es un día real (rechaza 2026-02-31). */
export function esFechaValida(v: string): boolean {
  const m = FECHA_RE.exec(v);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(anio, mes - 1, dia);
  return d.getFullYear() === anio && d.getMonth() === mes - 1 && d.getDate() === dia;
}

export function esGuid(v: string): boolean {
  return GUID_RE.test(v);
}

export interface ParamsCitas {
  desde: string;
  hasta: string;
  empleadoId: string;
  pagina: number;
  /** Día que comparten Calendario y Línea de tiempo ("YYYY-MM-DD"). */
  dia: string;
  /** Claves con valor inválido que hay que quitar de la URL. */
  invalidos: string[];
}

/**
 * Lee desde/hasta/empleadoId/pagina/dia. Sin parámetro, el período y el día son
 * `porDefecto`; un parámetro vacío en desde/hasta significa "sin límite" y se
 * respeta. El día siempre es una fecha real: 2026-02-31 se descarta en vez de
 * pasar a marzo en el Calendario o llegar tal cual a la API desde el Gantt.
 */
export function leerParamsCitas(params: URLSearchParams, porDefecto: string): ParamsCitas {
  const invalidos: string[] = [];

  const fecha = (clave: "desde" | "hasta") => {
    const v = params.get(clave);
    if (v === null || v === "") return v ?? porDefecto;
    if (esFechaValida(v)) return v;
    invalidos.push(clave);
    return porDefecto;
  };

  const empleadoParam = params.get("empleadoId");
  let empleadoId = "";
  if (empleadoParam) {
    if (esGuid(empleadoParam)) empleadoId = empleadoParam;
    else invalidos.push("empleadoId");
  }

  const paginaParam = params.get("pagina");
  let pagina = 1;
  if (paginaParam !== null) {
    const n = Number(paginaParam);
    if (Number.isInteger(n) && n >= 1 && n <= PAGINA_MAXIMA) pagina = n;
    else invalidos.push("pagina");
  }

  const diaParam = params.get("dia");
  let dia = porDefecto;
  if (diaParam !== null) {
    if (esFechaValida(diaParam)) dia = diaParam;
    else invalidos.push("dia");
  }

  return { desde: fecha("desde"), hasta: fecha("hasta"), empleadoId, pagina, dia, invalidos };
}
