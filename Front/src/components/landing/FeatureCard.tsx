import type { ReactNode } from "react";
import { useFadeInUp } from "./useFadeInUp";
import { ACENTO } from "./constantes";

export function FeatureCard({ icon, title, desc, delay }: { icon: ReactNode; title: string; desc: string; delay?: number }) {
  const fade = useFadeInUp(delay);
  return (
    <div ref={fade.ref} style={fade.style} className="group p-6 rounded-2xl border border-slate-100 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: "rgb(var(--neutral-100))", color: ACENTO }}>
        {icon}
      </div>
      <h3 className="font-bold text-slate-900 mb-2 text-[15px]">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}
