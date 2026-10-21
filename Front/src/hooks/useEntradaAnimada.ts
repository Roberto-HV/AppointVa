import { useCallback, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Entrada escalonada de una lista solo la primera vez que aparece (OM-33): al
 * paginar, filtrar o volver a mostrarla, los elementos nuevos aparecen sin
 * animación. Con movimiento reducido nunca se anima.
 *
 * Uso: `<motion.div {...entrada} animate="show" variants={…}>`.
 */
export function useEntradaAnimada() {
  const reducirMovimiento = useReducedMotion();
  const [pendiente, setPendiente] = useState(true);
  const onAnimationComplete = useCallback(() => setPendiente(false), []);
  return {
    initial: pendiente && !reducirMovimiento ? ("hidden" as const) : false,
    onAnimationComplete,
  };
}
