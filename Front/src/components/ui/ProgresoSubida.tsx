import type { PorcentajeSubida } from "../../lib/imagenes";

interface Props {
  /** 0–100, o `null` si el navegador no informa el total (barra indeterminada). */
  porcentaje: PorcentajeSubida;
  /** Qué se sube, p. ej. "Subiendo logo". */
  etiqueta: string;
  className?: string;
}

/**
 * Barra fina con el avance de una subida de imagen.
 * - Sin total conocido, la barra es indeterminada: un 0 % fijo parecería colgado.
 * - Al llegar al 100 % el archivo ya salió, pero el servidor todavía lo procesa
 *   (optimiza y guarda): se dice "Procesando…" en vez de dejar la barra llena
 *   sin explicación.
 */
export default function ProgresoSubida({ porcentaje, etiqueta, className = "" }: Props) {
  const indeterminado = porcentaje === null;
  const valor = indeterminado ? 0 : Math.max(0, Math.min(100, Math.round(porcentaje)));
  const procesando = !indeterminado && valor >= 100;

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminado || procesando ? undefined : valor}
        aria-valuetext={procesando ? "Procesando" : indeterminado ? "Subiendo" : undefined}
        data-estado={indeterminado ? "indeterminado" : procesando ? "procesando" : "subiendo"}
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
      >
        {indeterminado || procesando ? (
          <div className="h-full w-full rounded-full bg-primary/60 animate-pulse motion-reduce:animate-none" />
        ) : (
          <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${valor}%` }} />
        )}
      </div>
      {procesando && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          Procesando…
        </p>
      )}
    </div>
  );
}
