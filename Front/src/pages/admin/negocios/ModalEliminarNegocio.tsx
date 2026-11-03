import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { adminApi, type NegocioMetricasDto } from "../../../api/admin";
import Modal from "../../../components/ui/Modal";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import { useToastStore } from "../../../store/toastStore";
import { BOTON_PIE, BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO, CAMPO_MODAL, CAMPO_OK } from "./estilos";

/**
 * Eliminar un negocio en dos pasos: escribir su nombre y luego confirmar. El
 * contenido se monta al abrir, así que siempre empieza en el paso 1 y en blanco.
 */
export default function ModalEliminarNegocio({
  negocio,
  abierto,
  onCerrar,
  onEliminado,
}: {
  negocio: NegocioMetricasDto | null;
  abierto: boolean;
  onCerrar: () => void;
  /** Después de borrar (la ficha vuelve a la lista: el negocio ya no existe). */
  onEliminado?: (id: string) => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Eliminar negocio" ancho="sm">
      {negocio && <PasosEliminar negocio={negocio} onCerrar={onCerrar} onEliminado={onEliminado} />}
    </Modal>
  );
}

function PasosEliminar({
  negocio,
  onCerrar,
  onEliminado,
}: {
  negocio: NegocioMetricasDto;
  onCerrar: () => void;
  onEliminado?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const [pasoEliminar, setPasoEliminar] = useState<1 | 2>(1);
  const [nombreConfirmacion, setNombreConfirmacion] = useState("");

  const { mutate: eliminarNegocio, isPending: eliminandoNegocio } = useMutation({
    mutationFn: (id: string) => adminApi.eliminarNegocio(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["admin-negocios-metricas"] });
      qc.invalidateQueries({ queryKey: ["admin-negocios"] });
      qc.invalidateQueries({ queryKey: ["admin-suscripciones"] });
      onCerrar();
      toast("Negocio eliminado correctamente");
      onEliminado?.(id);
    },
    onError: () => toast("Error al eliminar el negocio.", "error"),
  });

  if (pasoEliminar === 1) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Esta acción es permanente y eliminará todos los datos del negocio.
        </p>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Escribe el nombre del negocio para confirmar:
          </label>
          <input
            type="text"
            value={nombreConfirmacion}
            onChange={e => setNombreConfirmacion(e.target.value)}
            placeholder={negocio.nombre}
            className={`${CAMPO_MODAL} ${CAMPO_OK}`}
          />
        </div>
        {/* Pie compartido de los modales: en el teléfono, apilado y fijo abajo. */}
        <ModalAcciones>
          <button onClick={onCerrar} className={BOTON_PIE_SECUNDARIO}>
            Cancelar
          </button>
          <button
            onClick={() => setPasoEliminar(2)}
            disabled={nombreConfirmacion !== negocio.nombre}
            className={BOTON_PIE_PRIMARIO}
          >
            Continuar
          </button>
        </ModalAcciones>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4 text-center">
        <AlertTriangle size={28} className="mx-auto mb-2 text-red-600 dark:text-red-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Última oportunidad</p>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
        Estás a punto de eliminar permanentemente{" "}
        <strong className="text-slate-900 dark:text-white">"{negocio.nombre}"</strong>.{" "}
        Esta acción <strong>NO se puede deshacer</strong>.
      </p>
      <ModalAcciones>
        <button onClick={() => setPasoEliminar(1)} className={BOTON_PIE_SECUNDARIO}>
          Volver
        </button>
        <button
          onClick={() => eliminarNegocio(negocio.id)}
          disabled={eliminandoNegocio}
          className={`${BOTON_PIE} font-semibold bg-red-700 hover:bg-red-800 text-white`}
        >
          {eliminandoNegocio ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </ModalAcciones>
    </div>
  );
}
