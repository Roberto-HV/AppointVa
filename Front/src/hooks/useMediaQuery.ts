import { useEffect, useState } from "react";

/**
 * true mientras la consulta de medios coincide. Sin `matchMedia` (jsdom, SSR)
 * devuelve false, así que la vista por defecto es la de escritorio.
 */
export function useMediaQuery(consulta: string): boolean {
  const [coincide, setCoincide] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(consulta).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(consulta);
    const onChange = () => setCoincide(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [consulta]);
  return coincide;
}

/** Por debajo del breakpoint `sm` de Tailwind (640px). */
export const CONSULTA_MOVIL = "(max-width: 639.98px)";
