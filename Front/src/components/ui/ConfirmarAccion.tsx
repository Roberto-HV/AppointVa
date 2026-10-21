import type { ReactNode } from "react";
import Modal from "./Modal";

interface Props {
  abierto: boolean;
  titulo: string;
  /** Qué va a pasar y qué cambia después, con los datos concretos (monto, cliente…). */
  mensaje: ReactNode;
  etiquetaConfirmar: string;
  /** Texto del botón que cierra sin hacer nada. */
  etiquetaVolver?: string;
  destructiva?: boolean;
  pendiente?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}

/**
 * Confirmación para acciones con consecuencias (revertir un pago, anular un
 * anticipo). El botón que confirma nombra la acción, no "Aceptar", y el que
 * cierra dice "Volver" para no confundirse con "Cancelar cita".
 */
export default function ConfirmarAccion({
  abierto, titulo, mensaje, etiquetaConfirmar, etiquetaVolver = "Volver",
  destructiva = false, pendiente = false, onConfirmar, onCerrar,
}: Props) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={titulo} ancho="sm">
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">{mensaje}</div>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {etiquetaVolver}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={pendiente}
            className={`min-h-[44px] lg:min-h-[36px] flex-1 px-4 rounded-xl text-sm font-semibold transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              destructiva
                ? "bg-red-700 hover:bg-red-800 text-white"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {pendiente ? "Procesando…" : etiquetaConfirmar}
          </button>
        </div>
      </div>
    </Modal>
  );
}
