import { AlertTriangle, Ban } from "lucide-react";
interface Props {
  valor: number;
  maximo: number;
  label: string;
}

export default function BarraProgreso({ valor, maximo, label }: Props) {
  const pct = maximo > 0 ? Math.min(Math.round((valor / maximo) * 100), 100) : 0;
  const colorBarra = pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";
  const colorTexto = pct >= 85
    ? "text-red-600 dark:text-red-400 font-semibold"
    : pct >= 60
    ? "text-amber-600 dark:text-amber-400 font-semibold"
    : "text-slate-500 dark:text-slate-400";
  const restantes = maximo - valor;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400 dark:text-slate-500">{label}</span>
        <span className={colorTexto}>
          {valor} / {maximo} <span className="text-slate-400 dark:text-slate-500">({pct}%)</span>
        </span>
      </div>
      {/* El carril sin variante oscura quedaba casi blanco sobre la tarjeta
          oscura y se leía como barra llena al 100%. */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          data-testid="barra-fill"
          className={`h-full rounded-full transition-all duration-500 ${colorBarra}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct >= 75 && (
        <p
          data-testid="aviso-restantes"
          className={`text-[10px] mt-0.5 ${
            pct >= 100
              ? "text-red-600 dark:text-red-400 font-bold"
              : pct >= 85
              ? "text-red-500 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {pct >= 100
            ? <><Ban size={11} className="inline -mt-px mr-1" aria-hidden="true" />Límite alcanzado</>
            : <><AlertTriangle size={11} className="inline -mt-px mr-1" aria-hidden="true" />{`${restantes} restante${restantes !== 1 ? "s" : ""}`}</>}
        </p>
      )}
    </div>
  );
}
