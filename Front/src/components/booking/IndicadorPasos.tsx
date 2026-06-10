interface Props {
  pasoActual: number;
  pasos: string[];
}

export default function IndicadorPasos({ pasoActual, pasos }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {pasos.map((nombre, i) => {
        const num = i + 1;
        const completado = num < pasoActual;
        const activo = num === pasoActual;

        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${completado ? "bg-primary text-white" : activo ? "bg-primary text-white ring-4 ring-primary/20" : "bg-gray-100 text-gray-400"}`}
              >
                {completado ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 font-medium ${activo ? "text-primary" : "text-gray-400"}`}>
                {nombre}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div className={`w-12 h-0.5 mb-4 mx-1 ${completado ? "bg-primary" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
