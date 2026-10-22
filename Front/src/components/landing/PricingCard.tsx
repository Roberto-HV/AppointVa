import { Link } from "react-router-dom";
import { precioVisible, formatMonto, MONEDA } from "../../lib/precios";
import { useFadeInUp } from "./useFadeInUp";
import { Ico } from "./Ico";
import { dCheck } from "./iconos";
import { DARK, SLATE_700 } from "./constantes";

interface Props {
  name: string;
  price: number;
  annualPrice?: number;
  employees: number;
  features: string[];
  /** Destino de "Empezar con …". */
  registro: string;
  highlighted?: boolean;
  delay?: number;
  comingSoon?: boolean;
  billedAnnually?: boolean;
}

export function PricingCard({
  name, price, annualPrice, employees, features, registro, highlighted = false, delay = 0, comingSoon = false, billedAnnually = false,
}: Props) {
  const fade = useFadeInUp(delay);
  // Un plan que aún no se puede contratar no lleva nota de facturación anual.
  const precio = precioVisible({ mensual: price, anual: annualPrice, disponible: !comingSoon }, billedAnnually);
  return (
    <div
      ref={fade.ref}
      style={{ ...fade.style, backgroundColor: highlighted ? DARK : "white", transform: `${fade.style.transform} ${highlighted ? "scale(1.04)" : ""}` }}
      className={`relative flex flex-col p-7 rounded-2xl border transition-all duration-300 ${highlighted ? "border-transparent shadow-2xl" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
    >
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-black text-slate-900 whitespace-nowrap" style={{ backgroundColor: "#E2E8F0" }}>
          Más popular
        </div>
      )}

      <div className="mb-6">
        <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${highlighted ? "text-slate-300" : "text-slate-400"}`}>{name}</p>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className={`text-5xl font-black tabular-nums ${highlighted ? "text-white" : "text-slate-900"}`}>${formatMonto(precio.porMes)}</span>
          <span className="text-sm text-slate-400">{`${MONEDA}/mes`}</span>
        </div>
        {precio.facturaAnual && (
          <p className={`text-xs font-semibold mb-1 ${highlighted ? "text-slate-300" : "text-slate-600"}`}>
            {`Facturado anual · Ahorras $${formatMonto(precio.ahorroAnual)} ${MONEDA}/año`}
          </p>
        )}
        {precio.sinPrecioAnual && (
          <p className={`text-xs font-semibold mb-1 ${highlighted ? "text-slate-300" : "text-slate-500"}`}>
            Sin descuento anual · Se factura mes a mes
          </p>
        )}
        <p className="text-xs text-slate-400">
          {employees} empleados
          {comingSoon && <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: "#F1F5F9", color: "#94A3B8", border: "1px solid #E2E8F0" }}>Próximamente</span>}
        </p>
      </div>

      <ul className="flex flex-col gap-3 mb-8 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex-shrink-0 ${highlighted ? "text-slate-300" : "text-slate-500"}`}><Ico d={dCheck} className="w-3.5 h-3.5" /></span>
            <span className={`text-sm leading-snug ${highlighted ? "text-slate-300" : "text-slate-600"}`}>{f}</span>
          </li>
        ))}
      </ul>

      {comingSoon ? (
        <div className="block text-center py-3 rounded-xl text-sm font-bold cursor-not-allowed select-none" style={{ backgroundColor: highlighted ? "#1E293B" : "#F1F5F9", color: highlighted ? "#475569" : "#94A3B8", border: `1px solid ${highlighted ? "#334155" : "#E2E8F0"}` }}>
          Próximamente disponible
        </div>
      ) : (
        <Link to={registro} className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: highlighted ? "#FFFFFF" : SLATE_700, color: highlighted ? DARK : "white" }}>
          Empezar con {name}
        </Link>
      )}
    </div>
  );
}
