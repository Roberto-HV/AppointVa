import type { ReactNode } from "react";
import { Check } from "lucide-react";

interface GrupoProps {
  titulo?: string;
  children: ReactNode;
}

export function GrupoFilas({ titulo, children }: GrupoProps) {
  return (
    <div>
      {titulo && (
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">{titulo}</p>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface FilaProps {
  activo: boolean;
  onSeleccionar: () => void;
  /** Acento derivado del color de marca (legible sobre blanco). */
  acento: string;
  /** Relleno claro derivado del color de marca. */
  tinte: string;
  titulo: string;
  descripcion?: string;
  /** Línea secundaria bajo la descripción (duración, etc.). */
  meta?: ReactNode;
  /** Bloque a la derecha antes de la miniatura (precio, etc.). */
  valor?: ReactNode;
  /** Slot inicial: avatar del empleado, icono, etc. */
  inicio?: ReactNode;
  /** Miniatura 1:1 al final. Sin imagen no se reserva espacio: el texto refluye. */
  imagenUrl?: string | null;
}

export default function FilaSeleccion({
  activo,
  onSeleccionar,
  acento,
  tinte,
  titulo,
  descripcion,
  meta,
  valor,
  inicio,
  imagenUrl,
}: FilaProps) {
  return (
    <button
      type="button"
      onClick={onSeleccionar}
      aria-pressed={activo}
      className="w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white transition-[background,box-shadow] duration-200
        hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-900"
      style={{
        background: activo ? tinte : undefined,
        // Anillo interior: 1px de borde → 2px de acento no mueve nada al seleccionar,
        // a diferencia de un border que sí ocupa espacio.
        boxShadow: activo ? `inset 0 0 0 2px ${acento}` : "inset 0 0 0 1px #e2e8f0",
      }}
    >
      {inicio}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{titulo}</p>
        {/* Clamp fijo: si creciera al seleccionar empujaría todo lo de abajo justo al tocar. */}
        {descripcion && <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">{descripcion}</p>}
        {meta && <div className="mt-1.5">{meta}</div>}
      </div>

      {valor && <div className="shrink-0 text-right">{valor}</div>}

      {imagenUrl && (
        <img
          src={imagenUrl}
          alt=""
          className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}

      <span
        aria-hidden="true"
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
          activo ? "" : "border-2 border-slate-200"
        }`}
        style={activo ? { background: acento } : undefined}
      >
        {activo && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  );
}
