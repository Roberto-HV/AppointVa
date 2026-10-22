import { isAxiosError } from "axios";
import { authApi } from "../api/auth";
import { kioscoApi } from "../api/kiosco";
import { useAuthStore } from "../store/authStore";
import type { LoginRespuesta } from "../types";
import { queryClient } from "./queryClient";

// ── Entrar y salir del modo recepción (decisión 3, DC-13, B9) ─────────────────
//
// Entrar cambia la sesión guardada por un token de kiosco: el refresh token del
// dueño se borra del almacenamiento y el servidor lo revoca, así que en el
// dispositivo no queda nada que devuelva la sesión sin la contraseña.
//
// Salir manda la contraseña a POST /kiosco/salir con el token de kiosco. El
// servidor la comprueba sin tocar el bloqueo de la cuenta y aplica su propio
// límite (3 intentos cada 5 minutos por negocio); al acertar devuelve una
// sesión normal, o el desafío 2FA si la cuenta lo tiene activo.

export const ROL_KIOSCO = "Kiosco";

/** Cambia la sesión actual por una de kiosco. Los errores se lanzan. */
export async function entrarAlKiosco(): Promise<void> {
  const sesion = await kioscoApi.iniciar(useAuthStore.getState().refreshToken);
  // Nada de la sesión del dueño se queda en la caché de la pantalla.
  queryClient.clear();
  useAuthStore.getState().iniciarSesionKiosco(sesion.token, sesion.usuario);
}

export type ResultadoSalida =
  | { tipo: "sesion"; respuesta: LoginRespuesta }
  | { tipo: "requiere2FA"; challengeToken: string }
  | { tipo: "incorrecta"; intentosRestantes: number | null }
  /** El servidor bloqueó la salida; `esperaMs` es lo que indica su 429. */
  | { tipo: "bloqueada"; esperaMs: number };

/** Ante un 429 sin cuerpo útil se asume la ventana completa del servidor. */
const ESPERA_POR_DEFECTO_MS = 5 * 60 * 1000;

/** Comprueba la contraseña del dueño. Errores distintos de 400/429 se lanzan. */
export async function salirDelKiosco(contrasena: string): Promise<ResultadoSalida> {
  try {
    const respuesta = await kioscoApi.salir(contrasena);
    if (respuesta.requiere2FA && respuesta.challengeToken) {
      return { tipo: "requiere2FA", challengeToken: respuesta.challengeToken };
    }
    return { tipo: "sesion", respuesta };
  } catch (err) {
    if (!isAxiosError(err)) throw err;
    const datos = err.response?.data as
      | { codigoError?: string; intentosRestantes?: number; reintentarEnSegundos?: number }
      | undefined;
    if (err.response?.status === 429) {
      const segundos = Number(datos?.reintentarEnSegundos);
      return { tipo: "bloqueada", esperaMs: segundos > 0 ? segundos * 1000 : ESPERA_POR_DEFECTO_MS };
    }
    if (err.response?.status === 400 && datos?.codigoError === "CONTRASENA_INCORRECTA") {
      const restantes = Number(datos.intentosRestantes);
      return { tipo: "incorrecta", intentosRestantes: Number.isFinite(restantes) ? restantes : null };
    }
    throw err;
  }
}

/** Segundo factor de la salida (mismo endpoint que el login). Los errores se lanzan. */
export function completarSalida2FA(challengeToken: string, codigo: string): Promise<LoginRespuesta> {
  return authApi.verificar2FA(challengeToken, codigo);
}

/** Guarda la sesión normal que devolvió la salida. */
export function restaurarSesion(respuesta: LoginRespuesta) {
  queryClient.clear();
  useAuthStore.getState().iniciarSesion(respuesta.token, respuesta.refreshToken, respuesta.usuario);
}
