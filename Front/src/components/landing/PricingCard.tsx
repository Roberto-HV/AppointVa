import { Link } from "react-router-dom";
import { precioVisible, formatMonto, MONEDA, urlRegistroConPlan, type ClavePlan } from "../../lib/precios";
import { useFadeInUp } from "./useFadeInUp";
import { Ico } from "./Ico";
import { dCheck } from "./iconos";
import { TINTA } from "./constantes";

interface Props {
  name: string;
  price: number;
  annualPrice?: number;
  employees: number;
  features: string[];
  /** Destino de "Empezar con …". */
  registro: string;
  /** Plan que se registra con la cuenta (`?plan=`, B20). */
  plan?: ClavePlan;
  highlighted?: boolean;
  delay?: number;
  comingSoon?: boolean;
  billedAnnually?: boolean;
}

export function PricingCard({
  name, price, annualPrice, employees, features, registro, plan, highlighted = false, delay = 0, comingSoon = false, billedAnnually = false,
}: Props) {
  const destino = plan ? urlRegistroConPlan(registro, plan) : registro;
  const fade = useFadeInUp(delay);
  // Un plan que aún no se puede contratar no lleva nota de facturación anual.
  const precio = precioVisible({ mensual: price, anual: annualPrice, disponible: !comingSoon }, billedAnnually);
  return (
    <div
      ref={fade.ref}
      style={{ ...fade.style, backgroundColor: highlighted ? TINTA : "white", transform: `${fade.style.transform} ${highlighted ? "scale(1.04)" : ""}` }}
      className={`relative flex flex-col p-7 rounded-2xl border transition-all duration-300 ${highlighted ? "border-transparent shadow-2xl" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
    >
      {highlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-semibold text-slate-900 whitespace-nowrap" style={{ backgroundColor: "rgb(var(--neutral-200))" }}>
          Más popular
        </div>
      )}

      <div className="mb-6">
        <p className={`text-sm font-semibold mb-3 ${highlighted ? "text-slate-300" : "text-slate-500"}`}>{name}</p>

        <div className="flex items-baseline gap-1.5 mb-1">
          <span className={`text-5xl font-semibold tabular-nums ${highlighted ? "text-white" : "text-slate-900"}`}>${formatMonto(precio.porMes)}</span>
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
          {comingSoon && <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: "rgb(var(--neutral-100))", color: "rgb(var(--neutral-500))", border: "1px solid rgb(var(--neutral-200))" }}>Próximamente</span>}
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
        <div className="block text-center py-3 rounded-xl text-sm font-bold cursor-not-allowed select-none" style={{ backgroundColor: highlighted ? "rgb(var(--neutral-800))" : "rgb(var(--neutral-100))", color: highlighted ? "rgb(var(--neutral-600))" : "rgb(var(--neutral-400))", border: `1px solid ${highlighted ? "rgb(var(--neutral-700))" : "rgb(var(--neutral-200))"}` }}>
          Próximamente disponible
        </div>
      ) : (
        <Link to={destino} className="block text-center py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: highlighted ? "#FFFFFF" : TINTA, color: highlighted ? TINTA : "white" }}>
          Empezar con {name}
        </Link>
      )}
    </div>
  );
}
