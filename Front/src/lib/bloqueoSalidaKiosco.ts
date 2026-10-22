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

function guardar(estado: EstadoBloqueoSalida) {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    // Sin almacenamiento el límite solo dura lo que la pestaña.
  }
}

export function leerBloqueoSalida(ahora = Date.now()): EstadoBloqueoSalida {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return LIBRE;
    const estado = JSON.parse(crudo) as Partial<EstadoBloqueoSalida>;
    const intentos = Number(estado.intentos) || 0;
    const bloqueadoHasta = Number(estado.bloqueadoHasta) || 0;
    // Un bloqueo vencido empieza de cero.
    if (bloqueadoHasta && bloqueadoHasta <= ahora) return LIBRE;
    return { intentos, bloqueadoHasta };
  } catch {
    return LIBRE;
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
