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
// (429 tras varios intentos). Un token de kiosco restringido es B9.

/** `true` si la contraseña es correcta, `false` si no. Otros errores se lanzan. */
export async function verificarContrasena(email: string, contrasena: string): Promise<boolean> {
  try {
    const respuesta = await authApi.login(email, contrasena);
    if (!respuesta.requiere2FA && respuesta.refreshToken) {
      await authApi.logout(respuesta.refreshToken).catch(() => undefined);
    }
    return true;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) return false;
    throw err;
  }
}
