import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { citasApi, ESTADOS } from "../api/citas";
import { useToastStore } from "../store/toastStore";
import { useSectorTerms } from "./useSectorTerms";
import { mensajeError } from "../utils/errores";
import { urlConfirmacionWhatsApp } from "../utils/whatsapp";
import type { CitaDto } from "../types";

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
  /** La cita entera: solo sirve para armar el aviso de WhatsApp al confirmar (ver `avisoConfirmacion`). */
  cita?: CitaDto;
  /** Nombre del negocio para ese aviso. */
  nombreNegocio?: string | null;
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

/**
 * Enlace de WhatsApp a ofrecer tras confirmar. El servidor solo avisa por correo,
 * así que quien reservó con teléfono no se entera de que su cita quedó confirmada:
 * se lo manda el negocio. No se abre solo —el navegador bloquea lo que se abre sin
 * un toque, como pasó con la ventana de impresión del ticket—; el enlace lo abre
 * el botón del aviso, que sí es un toque del usuario. Si el aviso se va, la acción
 * sigue en la hoja de la cita (`AccionesCita`).
 */
function avisoConfirmacion({ estado, cita, nombreNegocio }: CambioEstado): string | null {
  if (estado !== ESTADOS.Confirmada || !cita?.telefonoCliente) return null;
  return urlConfirmacionWhatsApp(cita, nombreNegocio);
}

/**
 * Avisos de confirmación todavía en pantalla, por cita. El aviso dura 8 s y su
 * temporizador se pausa con el puntero encima, así que puede seguir ahí cuando la
 * cita ya cambió: su botón mandaría "quedó *confirmada*" de una cita recién
 * cancelada. "Deshacer" no tiene ese problema porque vuelve al servidor y el
 * backend rechaza una cita finalizada; este mensaje sale sin consultar a nadie.
 * Por eso el aviso se retira en cuanto otro cambio sobre la misma cita se confirma.
 * La acción no se pierde: sigue en la hoja (`AccionesCita`), que sí mira el estado
 * actual. El registro vive fuera del hook porque confirmar y cancelar suelen venir
 * de instancias distintas (el botón de la fila y la hoja de acciones).
 */
const avisosPendientes = new Map<string, string>();

function recordarAviso(citaId: string, toastId: string) {
  // Se podan los avisos que ya se cerraron solos, para no acumular ids muertos.
  const vivos = new Set(useToastStore.getState().toasts.map((t) => t.id));
  for (const [id, tid] of avisosPendientes) if (!vivos.has(tid)) avisosPendientes.delete(id);
  avisosPendientes.set(citaId, toastId);
}

function retirarAviso(citaId: string) {
  const toastId = avisosPendientes.get(citaId);
  if (!toastId) return;
  avisosPendientes.delete(citaId);
  useToastStore.getState().quitar(toastId);
}

/**
 * El aviso ya se cerró cuando corre esto, así que si el navegador bloquea la
 * pestaña no queda nada en pantalla y el mensaje —el único que esa clienta iba a
 * recibir— se pierde en silencio. Se avisa y se dice dónde volver a encontrarlo.
 * No se pasa `noopener` en la cadena de opciones porque entonces `window.open`
 * devuelve null siempre y no habría forma de distinguir el bloqueo; se anula el
 * `opener` después, que protege igual.
 */
function abrirAviso(
  citaId: string,
  url: string,
  toast: ReturnType<typeof useToastStore.getState>["toast"],
) {
  const ventana = window.open(url, "_blank");
  if (ventana) {
    ventana.opener = null;
    return;
  }
  // El reintento viaja en el propio aviso en vez de mandar a buscar el botón de
  // la hoja: ese solo aparece si la lista ya se refrescó con la cita confirmada,
  // y con mala señal puede no estar. Así el enlace nunca se pierde de pantalla.
  // Se registra igual que el aviso original: si la cita se cancela o se mueve
  // mientras el reintento sigue ahí, también tiene que retirarse.
  const id = toast("El navegador bloqueó WhatsApp.", "error", {
    accion: { etiqueta: "Reintentar", onClick: () => abrirAviso(citaId, url, toast) },
  });
  recordarAviso(citaId, id);
}

export function useCambiarEstadoCita() {
  const qc = useQueryClient();
  const toast = useToastStore((s) => s.toast);
  const terms = useSectorTerms();
  const mutacion = useMutation({
    mutationFn: ({ id, estado, motivo }: CambioEstado) =>
      citasApi.cambiarEstado(id, { nuevoEstado: estado, motivo: motivo || undefined }),
    onSuccess: (_, cambio) => {
      invalidarCitas(qc);
      // Se retira al confirmarse el cambio, no al empezarlo: si la petición falla
      // la cita sigue confirmada y el aviso todavía sirve.
      retirarAviso(cambio.id);
      const aviso = avisoConfirmacion(cambio);
      if (esReversible(cambio)) {
        toast("Marcada como inasistencia", "exito", {
          accion: {
            etiqueta: "Deshacer",
            onClick: () => mutacion.mutate({ id: cambio.id, estado: cambio.anterior! }),
          },
        });
      } else if (aviso) {
        const sinCorreo = !cambio.cita?.emailCliente;
        const id = toast(
          sinCorreo
            ? `${terms.cita} confirmada. Sin correo: avísale tú.`
            : `${terms.cita} confirmada`,
          "exito",
          { accion: { etiqueta: "Avisar por WhatsApp", onClick: () => abrirAviso(cambio.id, aviso, toast) } },
        );
        recordarAviso(cambio.id, id);
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
    onSuccess: (_, { id }) => {
      invalidarCitas(qc);
      // Reagendar no cambia el estado, pero sí la fecha que lleva el aviso: si
      // siguiera en pantalla mandaría la hora vieja.
      retirarAviso(id);
      toast(`${terms.cita} reagendada`);
    },
    onError: (err) =>
      toast(mensajeError(err, `No se pudo reagendar la ${terms.cita.toLowerCase()}`), "error"),
  });
}
