interface Props {
  pasoActual: number;
  pasos: string[];
  slug?: string;
}

// Las barras van en blanco translúcido, no en el color de marca: sobre la tira
// oscura, el slate por defecto (#334155) quedaba en ~1.7:1 y el progreso no se veía.
const BARRA_HECHA = "rgba(255,255,255,0.55)";
const BARRA_ACTIVA = "rgba(255,255,255,0.9)";
const BARRA_PENDIENTE = "rgba(255,255,255,0.15)";

export default function IndicadorPasos({ pasoActual, pasos, slug }: Props) {
  const nombrePaso = pasos[pasoActual - 1];
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ background: "#18181B", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Barras de progreso y, debajo, el paso actual con su nombre. En una sola
          fila junto a "Mis citas" el nombre se cortaba a 375px ("Fecha y h…"). */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <ol className="flex shrink-0 items-center gap-1.5" aria-label="Progreso de la reserva">
          {pasos.map((nombre, i) => {
            const idx = i + 1;
            const isDone = idx < pasoActual;
            const isActive = idx === pasoActual;
            return (
              <li
                key={i}
                aria-current={isActive ? "step" : undefined}
                style={{
                  height: "3px",
                  borderRadius: "2px",
                  width: isActive ? "34px" : "22px",
                  background: isActive ? BARRA_ACTIVA : isDone ? BARRA_HECHA : BARRA_PENDIENTE,
                  transition: "all 0.3s ease",
                }}
              >
                <span className="sr-only">
                  {`${nombre}${isDone ? " (completado)" : ""}`}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>
          {`Paso ${pasoActual} de ${pasos.length}`}
          {nombrePaso && <span className="font-semibold text-white/90">{` · ${nombrePaso}`}</span>}
        </p>
      </div>

      {/* Mis citas */}
      {slug && (
        <a
          href={`/b/${slug}/mis-citas`}
          className="shrink-0 text-xs font-medium text-white/60 hover:text-white/90 transition flex items-center gap-1"
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
