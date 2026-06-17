interface Props {
  pasoActual: number;
  pasos: string[];
}

export default function IndicadorPasos({ pasoActual, pasos }: Props) {
  const total = pasos.length;
  const pct = (pasoActual / total) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
          Paso {pasoActual} de {total}
        </span>
        <span className="text-xs font-semibold text-slate-700">
          {pasos[pasoActual - 1]}
        </span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-700 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
