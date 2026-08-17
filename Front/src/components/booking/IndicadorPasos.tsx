interface Props {
  pasoActual: number;
  pasos: string[];
  color?: string;
  slug?: string;
}

export default function IndicadorPasos({ pasoActual, pasos, color = "#334155", slug }: Props) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ background: "#18181B", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Barras de progreso */}
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
                background: isDone || isActive ? color : "rgba(255,255,255,0.12)",
                transition: "all 0.3s ease",
              }}
            />
          );
        })}
        <span
          className="ml-2 text-xs"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          {pasoActual} de {pasos.length}
        </span>
      </div>

      {/* Mis citas */}
      {slug && (
        <a
          href={`/b/${slug}/mis-citas`}
          className="text-xs font-medium text-white/60 hover:text-white/90 transition flex items-center gap-1"
        >
          Mis citas
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      )}
    </div>
  );
}
