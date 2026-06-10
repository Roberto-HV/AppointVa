import { create } from "zustand";

export type TipoToast = "exito" | "error" | "info";

interface Toast {
  id: string;
  mensaje: string;
  tipo: TipoToast;
}

interface ToastStore {
  toasts: Toast[];
  toast: (mensaje: string, tipo?: TipoToast) => void;
  quitar: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  toast: (mensaje, tipo = "exito") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, mensaje, tipo }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      3500
    );
  },
  quitar: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
