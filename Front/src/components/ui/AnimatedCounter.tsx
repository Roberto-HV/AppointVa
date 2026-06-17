import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

interface Props {
  to: number;
  format?: (n: number) => string;
  className?: string;
}

export default function AnimatedCounter({ to, format, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(0, to, {
      duration: 0.9,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate(v) {
        el.textContent = format ? format(v) : Math.round(v).toLocaleString("es-MX");
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  return <span ref={ref} className={className}>{format ? format(0) : "0"}</span>;
}
