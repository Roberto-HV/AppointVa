import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock, Info } from "lucide-react";

/**
 * `neutro`: cualquier estado que no es pendiente ni confirmado (p. ej.
 * "Inasistencia" o uno desconocido). Muestra la etiqueta real en tono apagado,
 * sin prometer que la cita está por confirmarse.
 */
export type TonoSello = "confirmado" | "pendiente" | "neutro";

interface Props {
  etiqueta: string;
  tono: TonoSello;
}

const CLASES: Record<TonoSello, string> = {
  confirmado: "bg-status-confirmed-bg text-status-confirmed-fg",
  pendiente: "bg-status-pending-bg text-status-pending-fg",
  neutro: "bg-status-absent-bg text-status-absent-fg",
};

const ICONOS = { confirmado: Check, pendiente: Clock, neutro: Info } as const;

/**
 * Sello de estado sobre el talón de la confirmación. Cae una sola vez al montar
 * (escala y se asienta en 240 ms) y no se repite en cada render. Con "reducir
 * movimiento" aparece ya puesto, sin animación.
 */
export default function SelloEstado({ etiqueta, tono }: Props) {
  const reducirMovimiento = useReducedMotion();
  const Icono = ICONOS[tono];

  return (
    <motion.span
      data-animado={reducirMovimiento ? "no" : "si"}
      initial={reducirMovimiento ? false : { scale: 1.6, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: -6 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
      className={`inline-flex items-center gap-1.5 rounded-lg border-2 border-current px-3 py-1 text-sm font-semibold ${CLASES[tono]}`}
    >
      <Icono size={14} strokeWidth={2.75} aria-hidden="true" />
      {etiqueta}
    </motion.span>
  );
}
