import { useId, useState } from "react";

import { TINTA } from "./constantes";

/**
 * Pregunta frecuente plegable de las landings (`/` y `/salud`). Cada pregunta es
 * su propia tarjeta: el contenedor solo las apila con espacio entre ellas.
 */
export function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const idRespuesta = useId();
  return (
    <div className={`rounded-2xl bg-white px-6 transition-shadow duration-300 ${open ? "shadow-[0_2px_4px_rgb(15_23_42/0.06),0_14px_32px_-10px_rgb(15_23_42/0.16)]" : "shadow-[0_1px_2px_rgb(15_23_42/0.06),0_6px_18px_-8px_rgb(15_23_42/0.10)]"}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={idRespuesta}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <span className="font-semibold text-slate-900 text-[15px] group-hover:text-slate-700 transition-colors leading-snug">{q}</span>
        <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200" style={{ backgroundColor: open ? TINTA : "rgb(var(--neutral-100))", color: open ? "#FFFFFF" : "rgb(var(--neutral-500))" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true" className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      {open && (
        <p id={idRespuesta} className="text-sm text-slate-600 leading-relaxed pb-5 pr-10">{a}</p>
      )}
    </div>
  );
}
