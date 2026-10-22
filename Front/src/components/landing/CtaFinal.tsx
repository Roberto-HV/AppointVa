import { forwardRef } from "react";
import { Link } from "react-router-dom";

import { TINTA } from "./constantes";

interface CtaFinalProps {
  titulo: string;
  subtitulo: string;
  /** Destino del botón, p. ej. `/registro` o `/registro?sector=salud`. */
  to: string;
  etiqueta?: string;
}

/**
 * Bloque oscuro de cierre de las landings. Acentos en slate: el dorado de la
 * marca queda solo para el logo (AP-09).
 */
export const CtaFinal = forwardRef<HTMLElement, CtaFinalProps>(function CtaFinal(
  { titulo, subtitulo, to, etiqueta = "Empezar ahora" },
  ref,
) {
  return (
    <section ref={ref} style={{ backgroundColor: TINTA }} className="py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] blur-3xl opacity-10 pointer-events-none bg-slate-400" />
      <div className="relative max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">{titulo}</h2>
        <p className="text-slate-400 mb-10 text-lg">{subtitulo}</p>
        <Link
          to={to}
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-base bg-white text-slate-900 transition-all hover:scale-105 hover:bg-slate-100 active:scale-95 shadow-2xl"
        >
          {etiqueta}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
});
