// ── Límite de intentos para salir del modo recepción (DC-13) ─────────────────
//
// La salida del kiosco reutiliza POST /auth/login (ver `reautenticacion.ts`), así
// que cada contraseña incorrecta cuenta para el bloqueo de la cuenta del dueño.
// Para que alguien en la sala no la bloquee probando contraseñas, tras
// `MAX_INTENTOS_SALIDA` fallos el diálogo se bloquea `BLOQUEO_SALIDA_MS`. El
// estado vive en sessionStorage para que recargar la página no lo reinicie.
//
// Es una mitigación del lado del cliente (borrar el almacenamiento la salta).
// La solución real es un token de kiosco restringido que no exponga la cuenta
// del dueño (B9).

export const MAX_INTENTOS_SALIDA = 3;
export const BLOQUEO_SALIDA_MS = 5 * 60 * 1000;

const CLAVE = "kiosco-salida-bloqueo";

export interface EstadoBloqueoSalida {
  intentos: number;
  /** Epoch ms hasta el que la salida está bloqueada; 0 si no lo está. */
  bloqueadoHasta: number;
}

const LIBRE: EstadoBloqueoSalida = { intentos: 0, bloqueadoHasta: 0 };

// Respaldo en memoria: si sessionStorage no está disponible (bloqueado por el
// navegador), el límite sigue aplicando mientras la página no se recargue.
let enMemoria: EstadoBloqueoSalida = LIBRE;
/** true si la última escritura no llegó a sessionStorage: la memoria manda. */
let soloEnMemoria = false;

function guardar(estado: EstadoBloqueoSalida) {
  enMemoria = estado;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(estado));
    soloEnMemoria = false;
  } catch {
    soloEnMemoria = true;
  }
}

function vigente(estado: EstadoBloqueoSalida, ahora: number): EstadoBloqueoSalida {
  // Un bloqueo vencido empieza de cero.
  if (estado.bloqueadoHasta && estado.bloqueadoHasta <= ahora) return LIBRE;
  return estado;
}

export function leerBloqueoSalida(ahora = Date.now()): EstadoBloqueoSalida {
  // Si la última escritura falló, lo guardado está desactualizado.
  if (soloEnMemoria) return vigente(enMemoria, ahora);
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return LIBRE;
    const estado = JSON.parse(crudo) as Partial<EstadoBloqueoSalida>;
    const intentos = Number(estado.intentos) || 0;
    const bloqueadoHasta = Number(estado.bloqueadoHasta) || 0;
    return vigente({ intentos, bloqueadoHasta }, ahora);
  } catch {
    return vigente(enMemoria, ahora);
  }
}

/** Registra una contraseña incorrecta y devuelve el estado resultante. */
export function registrarFalloSalida(ahora = Date.now()): EstadoBloqueoSalida {
  const intentos = leerBloqueoSalida(ahora).intentos + 1;
  const estado = intentos >= MAX_INTENTOS_SALIDA
    ? { intentos, bloqueadoHasta: ahora + BLOQUEO_SALIDA_MS }
    : { intentos, bloqueadoHasta: 0 };
  guardar(estado);
  return estado;
}

export function limpiarBloqueoSalida() {
  enMemoria = LIBRE;
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
