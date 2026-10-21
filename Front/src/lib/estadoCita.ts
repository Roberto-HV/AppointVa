import { Clock, CheckCircle2, CheckCheck, XCircle, UserX, type LucideIcon } from "lucide-react";

// ── Estado de una cita: fuente única de etiqueta, icono y color ──────────────
//
// Antes había cuatro paletas a mano (badge, detalle, calendario, Gantt) que se
// contradecían: el verde era "Confirmada" en la lista y "Completada" en el
// detalle. Todas las vistas leen de aquí, y los colores salen de los tokens
// `--status-*` de `src/index.css`, que ya cambian con el tema.
//
// Las clases van escritas completas (sin interpolar) para que Tailwind las vea.
// El color nunca va solo: cada estado lleva icono y texto.

export type EstadoCita = "Pendiente" | "Confirmada" | "Completada" | "Cancelada" | "Inasistencia";

export interface EstiloEstadoCita {
  etiqueta: string;
  Icono: LucideIcon;
  /** Pastilla: fondo suave, texto y borde del token. */
  badge: string;
  /** Bloque relleno (calendario, Gantt): fondo + texto del token, borde izquierdo con el punto. */
  bloque: string;
  /** Punto o barra de color. */
  punto: string;
  /** Solo el color de texto. */
  texto: string;
}

export const ESTADO_CITA: Record<EstadoCita, EstiloEstadoCita> = {
  Pendiente: {
    etiqueta: "Pendiente",
    Icono: Clock,
    badge: "bg-status-pending-bg text-status-pending-fg border-status-pending-dot",
    bloque: "bg-status-pending-bg text-status-pending-fg border-l-[3px] border-status-pending-dot",
    punto: "bg-status-pending-dot",
    texto: "text-status-pending-fg",
  },
  Confirmada: {
    etiqueta: "Confirmada",
    Icono: CheckCircle2,
    badge: "bg-status-confirmed-bg text-status-confirmed-fg border-status-confirmed-dot",
    bloque: "bg-status-confirmed-bg text-status-confirmed-fg border-l-[3px] border-status-confirmed-dot",
    punto: "bg-status-confirmed-dot",
    texto: "text-status-confirmed-fg",
  },
  Completada: {
    etiqueta: "Completada",
    Icono: CheckCheck,
    badge: "bg-status-completed-bg text-status-completed-fg border-status-completed-dot",
    bloque: "bg-status-completed-bg text-status-completed-fg border-l-[3px] border-status-completed-dot",
    punto: "bg-status-completed-dot",
    texto: "text-status-completed-fg",
  },
  Cancelada: {
    etiqueta: "Cancelada",
    Icono: XCircle,
    badge: "bg-status-cancelled-bg text-status-cancelled-fg border-status-cancelled-dot",
    bloque: "bg-status-cancelled-bg text-status-cancelled-fg border-l-[3px] border-status-cancelled-dot",
    punto: "bg-status-cancelled-dot",
    texto: "text-status-cancelled-fg",
  },
  Inasistencia: {
    etiqueta: "Inasistencia",
    Icono: UserX,
    badge: "bg-status-absent-bg text-status-absent-fg border-status-absent-dot",
    bloque: "bg-status-absent-bg text-status-absent-fg border-l-[3px] border-status-absent-dot",
    punto: "bg-status-absent-dot",
    texto: "text-status-absent-fg",
  },
};

export const ESTADOS_CITA = Object.keys(ESTADO_CITA) as EstadoCita[];

/** Estilo de un estado que llega como texto del backend; los desconocidos se muestran neutros. */
export function estiloEstadoCita(estado: string | null | undefined): EstiloEstadoCita {
  const conocido = ESTADO_CITA[estado as EstadoCita];
  if (conocido) return conocido;
  return { ...ESTADO_CITA.Inasistencia, etiqueta: estado || "Sin estado", Icono: Clock };
}

/** Una cita en estos estados todavía admite acciones (confirmar, reagendar, cancelar…). */
export function citaAbierta(estado: string): boolean {
  return estado === "Pendiente" || estado === "Confirmada";
}

/**
 * Ya terminó pero sigue Pendiente o Confirmada: es trabajo sin cerrar
 * (completar, marcar inasistencia), no algo que se pueda atenuar.
 */
export function citaPorCerrar(cita: { estadoTexto: string; finEn: string }, ahora: Date = new Date()): boolean {
  return citaAbierta(cita.estadoTexto) && new Date(cita.finEn) < ahora;
}
