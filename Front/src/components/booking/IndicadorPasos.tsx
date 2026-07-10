interface Props {
  pasoActual: number;
  pasos: string[];
  color?: string;
}

export default function IndicadorPasos({ pasoActual, pasos, color = "#334155" }: Props) {
  const total = pasos.length;
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ background: "#18181B", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-center gap-1.5">
        {pasos.map((_, i) => {
          const idx = i + 1;
          const isDone = idx < pasoActual;
          const isActive = idx === pasoActual;
          return (
            <div
              key={i}
              style={{
                height: "3px",
                borderRadius: "2px",
                width: isActive ? "34px" : "22px",
                background: isDone || isActive ? color : "rgba(255,255,255,0.1)",
                transition: "all 0.3s ease",
              }}
            />
          );
        })}
      </div>
      <div className="text-right">
        <div
          className="text-[10px] uppercase"
          style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}
        >
          Paso {pasoActual} de {total}
        </div>
        <div className="text-xs font-bold text-white leading-tight">
          {pasos[pasoActual - 1]}
        </div>
      </div>
    </div>
  );
}
