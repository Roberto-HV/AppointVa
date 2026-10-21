interface Props {
  /** 0–100. */
  porcentaje: number;
  /** Qué se sube, p. ej. "Subiendo logo". */
  etiqueta: string;
  className?: string;
}

/** Barra fina con el avance de una subida de imagen. */
export default function ProgresoSubida({ porcentaje, etiqueta, className = "" }: Props) {
  const valor = Math.max(0, Math.min(100, Math.round(porcentaje)));
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className={`h-1.5 w-full rounded-full bg-muted overflow-hidden ${className}`}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${valor}%` }} />
    </div>
  );
}
