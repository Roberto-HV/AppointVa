import { useId, useState } from "react";

import { DARK } from "./constantes";

/** Pregunta frecuente plegable de las landings (`/` y `/salud`). */
export function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const idRespuesta = useId();
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={idRespuesta}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <span className="font-semibold text-slate-900 text-[15px] group-hover:text-slate-700 transition-colors leading-snug">{q}</span>
        <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200" style={{ backgroundColor: open ? DARK : "rgb(var(--neutral-100))", color: open ? "#FFFFFF" : "rgb(var(--neutral-500))" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true" className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </span>
      </button>
      {open && (
        <p id={idRespuesta} className="text-sm text-slate-500 leading-relaxed pb-5 pr-10">{a}</p>
      )}
    </div>
  );
}
