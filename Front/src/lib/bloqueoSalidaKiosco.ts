// ── Bloqueo de la salida del modo recepción (DC-13, B9) ──────────────────────
//
// El límite real lo aplica el servidor (3 intentos cada 5 minutos por negocio,
// POST /kiosco/salir). Cuando responde 429 indica cuánto esperar; aquí solo se
// recuerda hasta cuándo para mostrar la cuenta atrás y deshabilitar el diálogo.
// Vive en sessionStorage para que recargar la página no la borre; borrarlo no
// salta nada, porque el servidor volvería a responder 429.

const CLAVE = "kiosco-salida-bloqueo";

// Respaldo en memoria: si sessionStorage no está disponible (bloqueado por el
// navegador), la cuenta atrás sigue mientras la página no se recargue.
let enMemoria = 0;
/** true si la última escritura no llegó a sessionStorage: la memoria manda. */
let soloEnMemoria = false;

function vigente(bloqueadoHasta: number, ahora: number): number {
  return bloqueadoHasta > ahora ? bloqueadoHasta : 0;
}

/** Epoch ms hasta el que la salida está bloqueada; 0 si no lo está. */
export function leerBloqueoSalida(ahora = Date.now()): number {
  if (soloEnMemoria) return vigente(enMemoria, ahora);
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return 0;
    const estado = JSON.parse(crudo) as { bloqueadoHasta?: unknown };
    return vigente(Number(estado.bloqueadoHasta) || 0, ahora);
  } catch {
    return vigente(enMemoria, ahora);
  }
}

/** Registra el 429 del servidor y devuelve hasta cuándo dura. */
export function registrarBloqueoSalida(esperaMs: number, ahora = Date.now()): number {
  const bloqueadoHasta = ahora + Math.max(0, esperaMs);
  enMemoria = bloqueadoHasta;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ bloqueadoHasta }));
    soloEnMemoria = false;
  } catch {
    soloEnMemoria = true;
  }
  return bloqueadoHasta;
}

export function limpiarBloqueoSalida() {
  enMemoria = 0;
  soloEnMemoria = false;
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Nada que limpiar.
  }
}

/** "4:05" a partir de milisegundos restantes (redondeo hacia arriba). */
export function formatoCuentaAtras(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${String(segundos).padStart(2, "0")}`;
}
