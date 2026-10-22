import { create } from "zustand";
import { persist } from "zustand/middleware";
import { queryClient } from "../lib/queryClient";

interface UsuarioInfo {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: string;
  negocioId: string | null;
  fotoUrl?: string | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  usuario: UsuarioInfo | null;
  iniciarSesion: (token: string, refreshToken: string, usuario: UsuarioInfo) => void;
  /** Modo recepción (B9): token de kiosco y ningún refresh token guardado. */
  iniciarSesionKiosco: (token: string, usuario: UsuarioInfo) => void;
  /**
   * Cierra la sesión. Solo el refresh fallido de axios (`porRefreshFallido`)
   * adopta una sesión de kiosco guardada por otra pestaña; un logout explícito
   * (botón, inactividad) siempre limpia.
   */
  cerrarSesion: (opciones?: { porRefreshFallido?: boolean }) => void;
  estaAutenticado: () => boolean;
  actualizarFoto: (fotoUrl: string) => void;
}

export const CLAVE_AUTH = "appointva-auth";
const ROL_KIOSCO = "Kiosco";

/**
 * Sesión de kiosco guardada por OTRA pestaña (B9). Al entrar en modo recepción
 * se revoca el refresh token del dueño, así que una pestaña antigua acaba
 * fallando el refresh; ese `cerrarSesion` automático no debe borrar la sesión de
 * kiosco compartida en localStorage o la pantalla de recepción se cierra al recargar.
 */
function haySesionKioscoAjena(tokenEnMemoria: string | null): boolean {
  try {
    const crudo = localStorage.getItem(CLAVE_AUTH);
    if (!crudo) return false;
    const guardado = JSON.parse(crudo)?.state as
      | { token?: string | null; usuario?: { rol?: string } | null }
      | undefined;
    return !!guardado?.token && guardado.usuario?.rol === ROL_KIOSCO && guardado.token !== tokenEnMemoria;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      usuario: null,
      iniciarSesion: (token, refreshToken, usuario) =>
        set({ token, refreshToken, usuario }),
      iniciarSesionKiosco: (token, usuario) =>
        set({ token, refreshToken: null, usuario }),
      cerrarSesion: (opciones) => {
        queryClient.clear();
        if (opciones?.porRefreshFallido && haySesionKioscoAjena(get().token)) {
          // Adoptar la sesión de kiosco guardada en vez de pisarla con null.
          void useAuthStore.persist.rehydrate();
          return;
        }
        set({ token: null, refreshToken: null, usuario: null });
      },
      estaAutenticado: () => get().token !== null,
      actualizarFoto: (fotoUrl) =>
        set((s) => ({ usuario: s.usuario ? { ...s.usuario, fotoUrl } : null })),
    }),
    { name: CLAVE_AUTH }
  )
);

// Las pestañas comparten la sesión guardada: cuando otra la cambia (entrar o
// salir del kiosco, login, logout) esta se actualiza en vez de seguir con una
// sesión que el servidor ya revocó.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (evento) => {
    if (evento.key === CLAVE_AUTH && evento.storageArea === localStorage) {
      void useAuthStore.persist.rehydrate();
    }
  });
}
