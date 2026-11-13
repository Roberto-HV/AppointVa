import { create } from "zustand";
import { persist } from "zustand/middleware";
import { queryClient } from "../lib/queryClient";
import { useToastStore } from "./toastStore";

/** Lee la cuenta y el rol del envoltorio que `persist` guarda; null si no se puede. */
function usuarioGuardadoEn(valor: string | null): { id: string; rol: string } | null {
  try {
    const guardado = JSON.parse(valor ?? "null")?.state?.usuario;
    return guardado?.id && guardado?.rol ? { id: guardado.id, rol: guardado.rol } : null;
  } catch {
    return null;
  }
}

/**
 * Los avisos se montan fuera del árbol de rutas, así que sobreviven a un cambio
 * de sesión sin recargar la página. El de confirmación lleva dentro el teléfono y
 * los datos de la clienta y su botón abre WhatsApp sin consultar al servidor: en
 * una tablet compartida quien entre después —o quien pase frente al modo
 * recepción, que justamente abrevia los nombres— podría tocarlo.
 *
 * Se descartan solo cuando cambia **quién** está usando el equipo. Renovar el
 * token es la misma persona: el interceptor de axios llama a `iniciarSesion` en
 * cada 401, y confirmar una cita dispara refetches justo mientras el aviso está
 * en pantalla, así que borrarlos ahí le quitaría de las manos el único mensaje
 * que esa clienta iba a recibir.
 *
 * "Quién" es la cuenta **y** el rol, no solo la cuenta: al entrar al modo
 * recepción el servidor devuelve el mismo `Id` del dueño y solo cambia el `Rol`
 * a Kiosco (`KioscoController`), y es justo ahí donde la pantalla se vuelve
 * pública. Comparar solo el id —y no los dos campos de la línea de abajo—
 * dejaría el aviso vivo en ese caso.
 */
function descartarAvisosSiCambiaLaPersona(entrante: { id: string; rol: string } | null) {
  const actual = useAuthStore.getState().usuario;
  if (actual?.id === entrante?.id && actual?.rol === entrante?.rol) return;
  useToastStore.getState().quitarTodos();
}

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
/**
 * Borra solo la caché `images` del service worker: en una tablet compartida las
 * portadas y logos del negocio anterior sobreviven al cambio de usuario y
 * delatan con quién se trabajó. Nunca se vacía todo Cache Storage porque ahí
 * también vive el precaché que sostiene el modo offline.
 */
function limpiarCacheDeImagenes(): void {
  try {
    if (typeof caches === "undefined") return;
    void caches.delete("images").catch(() => {});
  } catch {
    // Safari lanza al tocar Cache Storage en navegación privada.
  }
}

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
      iniciarSesion: (token, refreshToken, usuario) => {
        descartarAvisosSiCambiaLaPersona(usuario);
        set({ token, refreshToken, usuario });
      },
      iniciarSesionKiosco: (token, usuario) => {
        // Aquí lo que cambia es el rol, no la cuenta: el servidor manda el mismo
        // id del dueño con Rol = Kiosco. La comparación lo cubre.
        descartarAvisosSiCambiaLaPersona(usuario);
        set({ token, refreshToken: null, usuario });
      },
      cerrarSesion: (opciones) => {
        queryClient.clear();
        descartarAvisosSiCambiaLaPersona(null);
        if (opciones?.porRefreshFallido && haySesionKioscoAjena(get().token)) {
          // Adoptar la sesión de kiosco guardada en vez de pisarla con null.
          void useAuthStore.persist.rehydrate();
          return;
        }
        limpiarCacheDeImagenes();
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
      // La rehidratación no pasa por las acciones del store, así que los avisos
      // se revisan aquí a mano. Solo se mira quién quedó guardado: la otra
      // pestaña también escribe esta clave al renovar su token o al cambiar la
      // foto, y eso no es otra persona. Un dato ilegible cuenta como «nadie»:
      // descarta los avisos si había sesión y no hace nada si tampoco la había,
      // que es el caso en el que no queda nada que proteger.
      descartarAvisosSiCambiaLaPersona(usuarioGuardadoEn(evento.newValue));
      void useAuthStore.persist.rehydrate();
    }
  });
}
