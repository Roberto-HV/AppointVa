import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Check } from "lucide-react";

interface GrupoProps {
  titulo?: string;
  children: ReactNode;
}

export function GrupoFilas({ titulo, children }: GrupoProps) {
  return (
    <div>
      {titulo && (
        <p className="text-sm font-semibold text-slate-700 mb-2.5">{titulo}</p>
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

/**
 * Mide si la descripción recortada a 3 renglones esconde texto. Se vuelve a medir
 * cuando cambia el ancho (giro del teléfono, rejilla de 2 columnas en 2xl).
 */
function useDesborda(ref: RefObject<HTMLElement | null>, texto: string | undefined, expandido: boolean) {
  const [desborda, setDesborda] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    // Desplegada no hay recorte que medir: se conserva el último resultado
    // para que «Ver menos» no desaparezca.
    if (!el || expandido) return;
    const medir = () => setDesborda(el.scrollHeight > el.clientHeight + 1);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref, texto, expandido]);
  return desborda;
}

/**
 * Tarjeta seleccionable. La tarjeta es un `div` y el botón de selección se estira
 * sobre toda ella con un `::after`: así cualquier parte de la tarjeta la elige y,
 * a la vez, «Ver más» puede ser un botón propio (un botón no puede ir dentro de otro).
 */
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
  const id = useId();
  const idDescripcion = `${id}-descripcion`;
  const idMeta = `${id}-meta`;
  const idValor = `${id}-valor`;
  const descripcionRef = useRef<HTMLParagraphElement>(null);
  const [expandido, setExpandido] = useState(false);
  const desborda = useDesborda(descripcionRef, descripcion, expandido);
  const describedBy = [descripcion && idDescripcion, meta && idMeta, valor && idValor].filter(Boolean).join(" ");

  return (
    <div
      className="relative w-full flex items-center gap-3 lg:gap-4 px-4 py-3.5 lg:px-5 lg:py-4 rounded-2xl bg-white transition-[background,box-shadow] duration-200 hover:bg-slate-50"
      style={{
        background: activo ? tinte : undefined,
        // Anillo interior: 1px de borde → 2px de acento no mueve nada al seleccionar,
        // a diferencia de un border que sí ocupa espacio.
        boxShadow: activo ? `inset 0 0 0 2px ${acento}` : "inset 0 0 0 1px hsl(var(--border))",
      }}
    >
      {inicio}

      <div className="flex-1 min-w-0">
        {/* En escritorio el texto sube un punto: a 14px/12px se veía diminuto en pantallas grandes. */}
        <button
          type="button"
          onClick={onSeleccionar}
          aria-pressed={activo}
          aria-describedby={describedBy || undefined}
          className="block w-full text-left text-sm lg:text-base font-semibold text-slate-900 rounded-2xl outline-none
            after:absolute after:inset-0 after:rounded-2xl after:content-['']
            focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-[-3px] focus-visible:after:outline-slate-900"
        >
          {titulo}
        </button>
        {/* Hasta 3 renglones y «Ver más» si no cabe: con el precio y la miniatura
            a un lado la columna queda angosta y a 2 renglones se leían tres palabras.
            El recorte no cambia al seleccionar, solo con el botón: si creciera al
            tocar la tarjeta empujaría todo lo de abajo. El texto completo siempre
            está en el DOM, así que el lector de pantalla lo lee entero. */}
        {descripcion && (
          <p
            id={idDescripcion}
            ref={descripcionRef}
            className={`mt-0.5 text-xs lg:text-sm text-slate-500 ${expandido ? "" : "line-clamp-3"}`}
          >
            {descripcion}
          </p>
        )}
        {descripcion && (desborda || expandido) && (
          // Encima del botón estirado (z-10): tocarlo despliega el texto, no elige la tarjeta.
          <button
            type="button"
            aria-expanded={expandido}
            aria-controls={idDescripcion}
            onClick={(e) => { e.stopPropagation(); setExpandido((v) => !v); }}
            className="relative z-10 mt-0.5 inline-flex min-h-[28px] items-center text-xs lg:text-sm font-semibold underline-offset-2 hover:underline rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            style={{ color: acento }}
          >
            {expandido ? "Ver menos" : "Ver más"}
          </button>
        )}
        {meta && <div id={idMeta} className="mt-1.5">{meta}</div>}
      </div>

      {valor && <div id={idValor} className="shrink-0 text-right">{valor}</div>}

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
    </div>
  );
}
