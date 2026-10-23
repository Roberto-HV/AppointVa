import { useId, useMemo } from "react";
import { Check } from "lucide-react";
import type { ServicioPublico } from "../../types";
import { formatPrecio } from "../../utils/formatters";
import { brandSolid, brandTint, DEFAULT_COLOR } from "../../lib/colorUtils";

interface Props {
  servicios: ServicioPublico[];
  seleccionado: ServicioPublico | null;
  onSeleccionar: (s: ServicioPublico) => void;
  color?: string;
  sector?: string;
}

interface Grupo {
  clave: string;
  titulo?: string;
  servicios: ServicioPublico[];
}

const TITULO_DESTACADOS = "Destacados";
const TITULO_OTROS = "Otros";

/**
 * Un destacado aparece solo en su grupo, no también bajo su categoría: duplicar la
 * fila rompe el "elige uno" y deja dos objetivos táctiles para el mismo servicio.
 */
function agrupar(servicios: ServicioPublico[]): Grupo[] {
  const destacados = servicios.filter((s) => s.destacado);
  const resto = servicios.filter((s) => !s.destacado);

  const categorias: Grupo[] = [];
  for (const s of resto) {
    if (!s.categoriaNombre) continue;
    const existente = categorias.find((g) => g.clave === s.categoriaNombre);
    if (existente) existente.servicios.push(s);
    else categorias.push({ clave: s.categoriaNombre, titulo: s.categoriaNombre, servicios: [s] });
  }

  const sinCategoria = resto.filter((s) => !s.categoriaNombre);
  const grupos: Grupo[] = [];

  if (destacados.length > 0) {
    grupos.push({ clave: TITULO_DESTACADOS, titulo: TITULO_DESTACADOS, servicios: destacados });
  }
  grupos.push(...categorias);
  if (sinCategoria.length > 0) {
    // Sin otros grupos no hay nada de qué distinguirlo: un encabezado genérico
    // inventado sobre la única lista es puro ruido.
    const soloGrupo = grupos.length === 0;
    grupos.push({
      clave: TITULO_OTROS,
      titulo: soloGrupo ? undefined : TITULO_OTROS,
      servicios: sinCategoria,
    });
  }

  return grupos;
}

interface FilaMenuProps {
  servicio: ServicioPublico;
  activo: boolean;
  onSeleccionar: () => void;
  /** Color sólido del negocio (contraste ≥ 4.5 con blanco) para la palomita. */
  solido: string;
  tinte: string;
}

/**
 * Una línea de carta impresa: nombre y precio sobre la misma línea base, unidos
 * por una guía punteada; la duración debajo en el tono apagado.
 *
 * Divergencia deliberada de `FilaSeleccion` (que usan PasoEmpleado y otros
 * pasos): aquí el layout es de carta/menú, no de fila con avatar. Si cambia el
 * estado seleccionado en `FilaSeleccion`, revisar que este siga a la par.
 */
function FilaMenu({ servicio, activo, onSeleccionar, solido, tinte }: FilaMenuProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSeleccionar}
        aria-pressed={activo}
        className="w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors duration-200 ease-calma
          hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-slate-900"
        style={activo ? { background: tinte } : undefined}
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200 ease-calma ${
            activo ? "" : "border-2 border-slate-300"
          }`}
          style={activo ? { background: solido } : undefined}
        >
          {activo && <Check size={12} strokeWidth={3} className="text-white" />}
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold text-slate-900">{servicio.nombre}</span>
            <span aria-hidden="true" className="flex-1 min-w-[1.5rem] border-b-2 border-dotted border-slate-300 translate-y-[-0.3em]" />
            <span className="shrink-0 text-[15px] font-semibold text-slate-900 tabular-nums">{formatPrecio(servicio.precio)}</span>
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 tabular-nums">{servicio.duracionMinutos} min</span>
          {/* Clamp fijo: si creciera al seleccionar empujaría todo lo de abajo justo al tocar. */}
          {servicio.descripcion && (
            <span className="mt-1 block text-xs text-slate-500 line-clamp-2">{servicio.descripcion}</span>
          )}
        </span>

        {servicio.imagenUrl && (
          <img
            src={servicio.imagenUrl}
            alt=""
            className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-100"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </button>
    </li>
  );
}

export default function PasoServicio({ servicios, seleccionado, onSeleccionar, color = DEFAULT_COLOR, sector }: Props) {
  const solido = useMemo(() => brandSolid(color), [color]);
  const tinte = useMemo(() => brandTint(color), [color]);
  const grupos = useMemo(() => agrupar(servicios), [servicios]);
  const idBase = useId();
  // Encabezados de categoría en Inter, como el resto de la reserva.
  const claseEncabezado = sector === "salud"
    ? "text-sm font-semibold text-slate-700"
    : "text-lg font-semibold text-slate-900";

  return (
    <div>
      <h2 tabIndex={-1} className="text-xl font-bold text-slate-900 mb-5 outline-none">{sector === "salud" ? "¿Qué tipo de consulta necesitas?" : "¿Qué te hacemos hoy?"}</h2>

      <div className="space-y-6">
        {grupos.map((grupo, i) => {
          const idTitulo = `${idBase}-grupo-${i}`;
          return (
            <section key={grupo.clave} aria-labelledby={grupo.titulo ? idTitulo : undefined}>
              {grupo.titulo && (
                <h3 id={idTitulo} className={`mb-2 ${claseEncabezado}`}>{grupo.titulo}</h3>
              )}
              <ul className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {grupo.servicios.map((servicio) => (
                  <FilaMenu
                    key={servicio.id}
                    servicio={servicio}
                    activo={seleccionado?.id === servicio.id}
                    onSeleccionar={() => onSeleccionar(servicio)}
                    solido={solido}
                    tinte={tinte}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
