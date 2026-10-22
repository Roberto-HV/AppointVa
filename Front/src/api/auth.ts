import { api } from "./axios";
import type { LoginRespuesta } from "../types";

export interface EstadoDosFactores {
  habilitado: boolean;
  tieneConfiguracion: boolean;
  /** Códigos de recuperación sin usar (0 con 2FA desactivado). */
  codigosRecuperacionRestantes: number;
}

export interface CodigosRecuperacionRespuesta {
  mensaje: string;
  codigosRecuperacion: string[];
}

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
  obtenerEstado2FA: async (): Promise<EstadoDosFactores> => {
    const { data } = await api.get("/auth/2fa/estado");
    return data;
  },

  configurar2FA: async (): Promise<{ uri: string; llave: string }> => {
    const { data } = await api.post("/auth/2fa/configurar");
    return data;
  },

  /** Devuelve los códigos de recuperación en claro: es la única vez que llegan. */
  activar2FA: async (codigo: string): Promise<CodigosRecuperacionRespuesta> => {
    const { data } = await api.post("/auth/2fa/activar", { codigo });
    return data;
  },

  /** Reemplaza todos los códigos; pide la contraseña o un código de la app. */
  regenerarCodigosRecuperacion: async (
    verificacion: { contrasena: string } | { codigo: string },
  ): Promise<CodigosRecuperacionRespuesta> => {
    const { data } = await api.post("/auth/2fa/codigos-recuperacion", verificacion);
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

  /** Mismo paso del login con un código de recuperación de un solo uso (B8). */
  verificar2FAConCodigoRecuperacion: async (challengeToken: string, codigoRecuperacion: string): Promise<LoginRespuesta> => {
    const { data } = await api.post("/auth/2fa/verificar", { challengeToken, codigoRecuperacion });
    return data;
  },

  eliminarCuenta: async (contrasena: string): Promise<void> => {
    await api.delete("/auth/cuenta", { data: { contrasena } });
  },
};

/**
 * Pide otro enlace de verificación. El servidor responde lo mismo exista o no
 * la cuenta ("Si el correo está registrado…"), así que no revela correos.
 */
export async function reenviarVerificacion(email: string): Promise<{ mensaje: string }> {
  const { data } = await api.post<{ mensaje: string }>("/publico/reenviar-verificacion", { email });
  return data;
}

export async function verificarSlug(slug: string): Promise<{ disponible: boolean }> {
  const res = await api.get<{ disponible: boolean }>("/publico/verificar-slug", {
    params: { slug },
  });
  return res.data;
}
