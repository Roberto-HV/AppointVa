import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

interface Props {
  to: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * Contador animado.
 * - Al cambiar `to` (p. ej. en el refresco de cada 30s) anima desde el valor
 *   anterior, no desde 0.
 * - Con "reducir movimiento" muestra el valor sin animar.
 * - El lector de pantalla lee siempre el valor final (texto `sr-only`); la cifra
 *   animada va oculta para él, así no anuncia "0" mientras cuenta.
 */
export default function AnimatedCounter({ to, format, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const desde = useRef(0);
  const reducir = useReducedMotion();
  const fmt = (v: number) => (format ? format(v) : Math.round(v).toLocaleString("es-MX"));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducir) {
      el.textContent = fmt(to);
      desde.current = to;
      return;
    }
    const controls = animate(desde.current, to, {
      duration: 0.9,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate(v) {
        el.textContent = fmt(v);
        desde.current = v;
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, reducir]);

  return (
    <span className={className}>
      {/* Contenido fijo mientras anima: si cambiara, React pisaría el texto animado. */}
      <span ref={ref} aria-hidden="true">{reducir ? fmt(to) : fmt(0)}</span>
      <span className="sr-only">{fmt(to)}</span>
    </span>
  );
}
