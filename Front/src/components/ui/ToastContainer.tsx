import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "../../store/toastStore";

export default function ToastContainer() {
  const { toasts, quitar } = useToastStore();

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.85 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium max-w-xs ${
              t.tipo === "exito"
                ? "bg-gray-900 text-white"
                : t.tipo === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 text-white"
            }`}
          >
            {t.tipo === "exito" && (
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            )}
            {t.tipo === "error" && <XCircle size={16} className="shrink-0" />}
            {t.tipo === "info" && <Info size={16} className="shrink-0" />}
            <span className="flex-1">{t.mensaje}</span>
            <button
              onClick={() => quitar(t.id)}
              className="text-white/50 hover:text-white transition shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
