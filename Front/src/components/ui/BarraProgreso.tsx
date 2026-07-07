interface Props {
  valor: number;
  maximo: number;
  label: string;
}

export default function BarraProgreso({ valor, maximo, label }: Props) {
  const pct = maximo > 0 ? Math.min(Math.round((valor / maximo) * 100), 100) : 0;
  const colorBarra = pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";
  const colorTexto = pct >= 85 ? "text-red-600 font-semibold" : pct >= 60 ? "text-amber-600 font-semibold" : "text-gray-500";
  const restantes = maximo - valor;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={colorTexto}>{valor} / {maximo} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          data-testid="barra-fill"
          className={`h-full rounded-full transition-all duration-500 ${colorBarra}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct >= 75 && (
        <p
          data-testid="aviso-restantes"
          className={`text-[10px] mt-0.5 ${pct >= 100 ? "text-red-600 font-bold" : pct >= 85 ? "text-red-500" : "text-amber-600"}`}
        >
          {pct >= 100 ? "⛔ Límite alcanzado" : `⚠️ ${restantes} restante${restantes !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
}
