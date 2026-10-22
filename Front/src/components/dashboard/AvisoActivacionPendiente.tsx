import { Mail } from "lucide-react";
import { ACTIVACION_AVISO, ACTIVACION_RESUMEN, CORREO_SOPORTE } from "../../lib/activacion";

/** Aviso del panel mientras el SuperAdmin no activa el negocio (AP-02). */
export default function AvisoActivacionPendiente() {
  return (
    <div
      role="status"
      className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-start gap-2.5"
    >
      <div className="w-5 h-5 mt-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
        <Mail size={11} className="text-amber-700 dark:text-amber-300" aria-hidden="true" />
      </div>
      <p className="text-xs text-amber-800 dark:text-amber-200">
        <span className="font-semibold">Tu negocio está pendiente de activación.</span>{" "}
        {ACTIVACION_RESUMEN} {ACTIVACION_AVISO}{" "}
        ¿Dudas?{" "}
        <a
          href={`mailto:${CORREO_SOPORTE}`}
          className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
        >
          Escríbenos a {CORREO_SOPORTE}
        </a>
      </p>
    </div>
  );
}
