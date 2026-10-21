import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export const CONSULTA_MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";

/**
 * Aparición suave (opacidad + 24px) al entrar en pantalla, compartida por las
 * dos landings. Con "reducir movimiento" el contenido se muestra desde el
 * principio, sin opacidad 0 ni desplazamiento (AP-20).
 */
export function useFadeInUp(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const reducido = useMediaQuery(CONSULTA_MOVIMIENTO_REDUCIDO);
  const [vis, setVis] = useState(false);
  // Sin IntersectionObserver (navegadores muy viejos) nunca llegaría el aviso.
  const sinObservador = typeof IntersectionObserver === "undefined";

  useEffect(() => {
    if (reducido || sinObservador) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducido, sinObservador]);

  const visible = reducido || sinObservador || vis;
  return {
    ref,
    style: {
      transition: reducido ? undefined : `opacity .65s ease ${delay}ms, transform .65s ease ${delay}ms`,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
    } as CSSProperties,
  };
}
