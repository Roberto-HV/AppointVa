import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UsuarioInfo {
  id: string;
  email: string;
  nombreCompleto: string;
  rol: string;
  negocioId: string | null;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  usuario: UsuarioInfo | null;
  iniciarSesion: (token: string, refreshToken: string, usuario: UsuarioInfo) => void;
  cerrarSesion: () => void;
  estaAutenticado: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      usuario: null,
      iniciarSesion: (token, refreshToken, usuario) =>
        set({ token, refreshToken, usuario }),
      cerrarSesion: () =>
        set({ token: null, refreshToken: null, usuario: null }),
      estaAutenticado: () => get().token !== null,
    }),
    { name: "appointva-auth" }
  )
);
