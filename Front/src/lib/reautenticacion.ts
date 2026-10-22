import { isAxiosError } from "axios";
import { authApi } from "../api/auth";

// ── Volver a pedir la contraseña del usuario actual (decisión 3, DC-13) ───────
//
// No hay endpoint de "verificar contraseña": se reutiliza POST /auth/login con
// el correo de la sesión. Si el login tiene éxito, la sesión nueva que crea se
// revoca enseguida (la del kiosco sigue siendo la misma). Si la cuenta tiene
// 2FA, el backend responde `requiere2FA`: eso ya prueba que la contraseña es
// correcta y el desafío se descarta.
//
// Limitación conocida: cada intento fallido cuenta para el bloqueo de la cuenta
// (429 tras varios intentos). El kiosco lo mitiga con un límite de intentos en
// el cliente (`bloqueoSalidaKiosco.ts`); la solución real es un token de kiosco
// restringido (B9).

export type ResultadoVerificacion =
  | { correcta: false }
  /** `sesionExtraRevocada: false` si el logout de la sesión de verificación falló. */
  | { correcta: true; sesionExtraRevocada: boolean };

/** Comprueba la contraseña. Errores distintos de 401 se lanzan. */
export async function verificarContrasena(email: string, contrasena: string): Promise<ResultadoVerificacion> {
  let respuesta: Awaited<ReturnType<typeof authApi.login>>;
  try {
    respuesta = await authApi.login(email, contrasena);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) return { correcta: false };
    throw err;
  }
  if (respuesta.requiere2FA || !respuesta.refreshToken) return { correcta: true, sesionExtraRevocada: true };
  try {
    await authApi.logout(respuesta.refreshToken);
    return { correcta: true, sesionExtraRevocada: true };
  } catch (err) {
    // La contraseña era correcta; solo queda viva una sesión extra hasta que caduque.
    console.warn("No se pudo revocar la sesión de verificación", err);
    return { correcta: true, sesionExtraRevocada: false };
  }
}
