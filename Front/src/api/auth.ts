import { api } from "./axios";
import type { LoginRespuesta } from "../types";

export const authApi = {
  login: async (email: string, contrasena: string): Promise<LoginRespuesta> => {
    const { data } = await api.post("/auth/login", { email, contrasena });
    return data;
  },

  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },

  logout: async (refreshToken: string) => {
    await api.post("/auth/logout", { refreshToken });
  },

  recuperarContrasena: async (email: string): Promise<{ mensaje: string }> => {
    const { data } = await api.post("/auth/recuperar-contrasena", { email });
    return data;
  },

  restablecerContrasena: async (email: string, token: string, nuevaContrasena: string): Promise<{ mensaje: string }> => {
    const { data } = await api.post("/auth/restablecer-contrasena", { email, token, nuevaContrasena });
    return data;
  },

  cambiarPassword: async (passwordActual: string, passwordNuevo: string): Promise<{ mensaje: string }> => {
    const { data } = await api.post("/auth/cambiar-password", { passwordActual, passwordNuevo });
    return data;
  },

  subirFotoPerfil: async (archivo: File): Promise<{ fotoUrl: string }> => {
    const form = new FormData();
    form.append("archivo", archivo);
    const { data } = await api.post("/auth/perfil/foto", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // 2FA
  obtenerEstado2FA: async (): Promise<{ habilitado: boolean; tieneConfiguracion: boolean }> => {
    const { data } = await api.get("/auth/2fa/estado");
    return data;
  },

  configurar2FA: async (): Promise<{ uri: string; llave: string }> => {
    const { data } = await api.post("/auth/2fa/configurar");
    return data;
  },

  activar2FA: async (codigo: string): Promise<{ mensaje: string }> => {
    const { data } = await api.post("/auth/2fa/activar", { codigo });
    return data;
  },

  desactivar2FA: async (codigo: string): Promise<{ mensaje: string }> => {
    const { data } = await api.post("/auth/2fa/desactivar", { codigo });
    return data;
  },

  verificar2FA: async (challengeToken: string, codigo: string): Promise<LoginRespuesta> => {
    const { data } = await api.post("/auth/2fa/verificar", { challengeToken, codigo });
    return data;
  },
};
