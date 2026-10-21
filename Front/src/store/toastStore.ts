import { create } from "zustand";

export type TipoToast = "exito" | "error" | "info";

/** Botón dentro del toast, p. ej. "Deshacer". Al pulsarlo el toast se cierra. */
export interface AccionToast {
  etiqueta: string;
  onClick: () => void;
}

export interface OpcionesToast {
  accion?: AccionToast;
  /** Milisegundos antes de cerrarse. Por defecto depende del tipo (ver `DURACION_TOAST`). */
  duracion?: number;
}

export interface Toast {
  id: string;
  mensaje: string;
  tipo: TipoToast;
  accion?: AccionToast;
}

// Los errores y los toasts con acción duran más: un mensaje del servidor largo
// o un "Deshacer" no deben desaparecer antes de que alguien pueda leerlos.
export const DURACION_TOAST = {
  normal: 3500,
  error: 8000,
  conAccion: 8000,
} as const;

interface ToastStore {
  toasts: Toast[];
  /** Devuelve el id del toast. */
  toast: (mensaje: string, tipo?: TipoToast, opciones?: OpcionesToast) => string;
  quitar: (id: string) => void;
  /** Ejecuta la acción del toast (una sola vez) y lo cierra. */
  ejecutarAccion: (id: string) => void;
  /** Detiene el cierre automático (puntero o foco encima). */
  pausar: (id: string) => void;
  reanudar: (id: string) => void;
}

interface Temporizador {
  handle: ReturnType<typeof setTimeout> | null;
  restante: number;
  inicio: number;
}

const temporizadores = new Map<string, Temporizador>();

function limpiar(id: string) {
  const t = temporizadores.get(id);
  if (t?.handle) clearTimeout(t.handle);
  temporizadores.delete(id);
}

export const useToastStore = create<ToastStore>((set, get) => {
  const programar = (id: string, ms: number) => {
    const handle = setTimeout(() => get().quitar(id), ms);
    temporizadores.set(id, { handle, restante: ms, inicio: Date.now() });
  };

  return {
    toasts: [],
    toast: (mensaje, tipo = "exito", opciones = {}) => {
      const id = crypto.randomUUID();
      const duracion =
        opciones.duracion ??
        (opciones.accion ? DURACION_TOAST.conAccion : tipo === "error" ? DURACION_TOAST.error : DURACION_TOAST.normal);
      set((s) => ({ toasts: [...s.toasts, { id, mensaje, tipo, accion: opciones.accion }] }));
      programar(id, duracion);
      return id;
    },
    quitar: (id) => {
      limpiar(id);
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    ejecutarAccion: (id) => {
      const toast = get().toasts.find((t) => t.id === id);
      get().quitar(id);
      toast?.accion?.onClick();
    },
    pausar: (id) => {
      const t = temporizadores.get(id);
      if (!t?.handle) return;
      clearTimeout(t.handle);
      temporizadores.set(id, { handle: null, restante: Math.max(0, t.restante - (Date.now() - t.inicio)), inicio: 0 });
    },
    reanudar: (id) => {
      const t = temporizadores.get(id);
      if (!t || t.handle) return;
      programar(id, t.restante);
    },
  };
});
