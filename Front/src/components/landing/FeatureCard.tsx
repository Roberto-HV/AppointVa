import type { ReactNode } from "react";
import { useFadeInUp } from "./useFadeInUp";
import { ACENTO } from "./constantes";

/**
 * Tarjeta de característica de las landings. `tono` (1–8) toma un color de la
 * paleta categórica (--categoria-N) para el icono; sin él, el acento de marca.
 */
export function FeatureCard({ icon, title, desc, delay, tono }: { icon: ReactNode; title: string; desc: string; delay?: number; tono?: number }) {
  const fade = useFadeInUp(delay);
  const color = tono ? `var(--categoria-${tono})` : ACENTO;
  return (
    <div ref={fade.ref} style={fade.style} className="group h-full">
      <div className="h-full p-7 rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_24px_-6px_rgb(15_23_42/0.10)] transition-[box-shadow,transform] duration-300 ease-calma hover:-translate-y-1 hover:shadow-[0_2px_4px_rgb(15_23_42/0.06),0_18px_40px_-10px_rgb(15_23_42/0.18)]">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 ease-calma group-hover:scale-105"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, white)`, color }}
        >
          {icon}
        </div>
        <h3 className="font-bold text-slate-900 mb-2 text-base">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
