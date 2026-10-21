import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { citasApi } from "../api/citas";
import { useToastStore } from "../store/toastStore";
import { useSectorTerms } from "./useSectorTerms";

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

/** Mensaje que manda el backend, o el texto por defecto. */
export function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? porDefecto;
}

export function useCambiarEstadoCita() {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: number; motivo?: string }) =>
      citasApi.cambiarEstado(id, { nuevoEstado: estado, motivo: motivo || undefined }),
    onSuccess: () => {
      invalidarCitas(qc);
      toast("Estado actualizado");
    },
    onError: (err) => toast(mensajeError(err, "No se pudo cambiar el estado"), "error"),
  });
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
