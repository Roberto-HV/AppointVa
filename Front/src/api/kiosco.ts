import { api } from "./axios";
import type { LoginRespuesta, UsuarioInfo } from "../types";

// ── Modo recepción (B9, decisión 3) ───────────────────────────────────────────
// La pantalla de recepción no usa la sesión del dueño: usa un token de kiosco
// (12 h, sin refresh) que solo puede leer la agenda de hoy y pedir salir.

export interface SesionKiosco {
  token: string;
  tokenExpiracion: string;
  usuario: UsuarioInfo;
}

export interface EmpleadoKiosco {
  id: string;
  nombre: string;
}

export interface CitaKiosco {
  id: string;
  empleadoId: string;
  /** Ya viene como nombre + inicial (DC-28). */
  nombreCliente: string;
  nombreServicio: string;
  duracionMinutos: number;
  precio: number;
  pagada: boolean;
  inicioEn: string;
  finEn: string;
  estadoTexto: string;
}

export interface AgendaKiosco {
  nombreNegocio: string;
  sector: string;
  /** false si abrió la pantalla un empleado: los ingresos del día no se muestran. */
  mostrarIngresos: boolean;
  empleados: EmpleadoKiosco[];
  citas: CitaKiosco[];
}

export const kioscoApi = {
  /** Con la sesión normal: devuelve el token de kiosco y revoca `refreshToken`. */
  iniciar: async (refreshToken: string | null): Promise<SesionKiosco> => {
    const { data } = await api.post("/kiosco/sesion", { refreshToken });
    return data;
  },

  agenda: async (): Promise<AgendaKiosco> => {
    const { data } = await api.get("/kiosco/agenda");
    return data;
  },

  /** Con el token de kiosco: misma respuesta que `POST /auth/login`. */
  salir: async (contrasena: string): Promise<LoginRespuesta> => {
    const { data } = await api.post("/kiosco/salir", { contrasena });
    return data;
  },
};
