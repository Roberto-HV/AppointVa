import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore, type Toast } from "../../store/toastStore";

// Dos regiones vivas siempre montadas: los lectores de pantalla solo anuncian
// lo que entra en una región que ya existía. Éxito/info van en `status`
// (educado); los errores en `alert` (interrumpe).
export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const errores = toasts.filter((t) => t.tipo === "error");
  const avisos = toasts.filter((t) => t.tipo !== "error");

  // `--barra-accion` lo publica la página que tenga una barra de acción pegada al
  // fondo. Sin ella el cálculo da el `bottom-5` de siempre; con ella los toasts
  // aterrizan justo encima y no tapan el botón en pantallas estrechas.
  return (
    <div className="fixed bottom-[calc(1.25rem_+_var(--barra-accion,0px))] right-4 left-4 sm:left-auto sm:right-5 z-[200] flex flex-col items-end gap-2 pointer-events-none">
      <div role="alert" aria-live="assertive" aria-atomic="false" className="flex flex-col items-end gap-2">
        <ListaToasts toasts={errores} />
      </div>
      <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col items-end gap-2">
        <ListaToasts toasts={avisos} />
      </div>
    </div>
  );
}

function ListaToasts({ toasts }: { toasts: Toast[] }) {
  const { quitar, ejecutarAccion, pausar, reanudar } = useToastStore();
  return (
    <AnimatePresence mode="popLayout">
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          layout
          initial={{ opacity: 0, x: 80, scale: 0.85 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.85 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          onPointerEnter={() => pausar(t.id)}
          onPointerLeave={() => reanudar(t.id)}
          onFocus={() => pausar(t.id)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) reanudar(t.id);
          }}
          className={`pointer-events-auto flex items-center gap-3 pl-4 pr-1 py-1 min-h-[48px] rounded-xl shadow-2xl text-sm font-medium w-full sm:w-auto sm:max-w-sm ${
            t.tipo === "exito"
              ? "bg-gray-900 text-white dark:bg-slate-700"
              : t.tipo === "error"
              ? "bg-red-700 text-white"
              : "bg-slate-800 text-white dark:bg-slate-700"
          }`}
        >
          {t.tipo === "exito" && <CheckCircle2 size={16} className="text-green-400 shrink-0" aria-hidden="true" />}
          {t.tipo === "error" && <XCircle size={16} className="shrink-0" aria-hidden="true" />}
          {t.tipo === "info" && <Info size={16} className="shrink-0" aria-hidden="true" />}
          <span className="flex-1 py-2">{t.mensaje}</span>
          {t.accion && (
            <button
              type="button"
              onClick={() => ejecutarAccion(t.id)}
              className="shrink-0 min-h-[44px] lg:min-h-[36px] px-3 rounded-lg font-semibold underline underline-offset-2 hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t.accion.etiqueta}
            </button>
          )}
          <button
            type="button"
            onClick={() => quitar(t.id)}
            aria-label="Cerrar aviso"
            className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
