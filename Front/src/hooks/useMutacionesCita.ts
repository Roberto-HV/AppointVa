import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { citasApi, ESTADOS } from "../api/citas";
import { useToastStore } from "../store/toastStore";
import { useSectorTerms } from "./useSectorTerms";
import { mensajeError } from "../utils/errores";

// Mutaciones de una cita compartidas por la lista, el calendario, el Gantt, el
// inicio y el detalle. Invalida todas las vistas que muestran citas, para que
// un cambio hecho desde cualquier pantalla se vea en las demás.

const CLAVES_CITAS = [
  "citas",
  "citas-cal",
  "citas-badge",
  "citas-gantt",
  "cita",
  "dashboard-resumen",
  "citas-agenda-hoy",
  "mis-citas-hoy",
  "mis-citas-proximas",
  "mis-citas-semana",
  "citas-pagos",
] as const;

export function invalidarCitas(qc: QueryClient) {
  for (const clave of CLAVES_CITAS) qc.invalidateQueries({ queryKey: [clave] });
}

interface CambioEstado {
  id: string;
  estado: number;
  motivo?: string;
  /** Estado previo: solo sirve para ofrecer "Deshacer" cuando el cambio es reversible (ver `esReversible`). */
  anterior?: number;
}

/**
 * Solo "Confirmada → Inasistencia" se deshace con el endpoint inverso: el
 * backend resta la inasistencia del cliente al salir de ese estado y no envía
 * correos. Confirmar (correo al cliente), completar y cancelar (estados finales
 * que el backend ya no deja modificar) no se pueden deshacer.
 */
function esReversible({ estado, anterior }: CambioEstado) {
  return estado === ESTADOS.Inasistencia && anterior === ESTADOS.Confirmada;
}

export function useCambiarEstadoCita() {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const mutacion = useMutation({
    mutationFn: ({ id, estado, motivo }: CambioEstado) =>
      citasApi.cambiarEstado(id, { nuevoEstado: estado, motivo: motivo || undefined }),
    onSuccess: (_, cambio) => {
      invalidarCitas(qc);
      if (esReversible(cambio)) {
        toast("Marcada como inasistencia", "exito", {
          accion: {
            etiqueta: "Deshacer",
            onClick: () => mutacion.mutate({ id: cambio.id, estado: cambio.anterior! }),
          },
        });
      } else {
        toast("Estado actualizado");
      }
    },
    onError: (err) => toast(mensajeError(err, "No se pudo cambiar el estado"), "error"),
  });
  return mutacion;
}

export function useReagendarCita() {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const terms = useSectorTerms();
  return useMutation({
    mutationFn: ({ id, inicioEn }: { id: string; inicioEn: string }) => citasApi.reagendar(id, inicioEn),
    onSuccess: () => {
      invalidarCitas(qc);
      toast(`${terms.cita} reagendada`);
    },
    onError: (err) =>
      toast(mensajeError(err, `No se pudo reagendar la ${terms.cita.toLowerCase()}`), "error"),
  });
}
