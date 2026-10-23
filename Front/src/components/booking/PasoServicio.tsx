import { useId, useMemo } from "react";
import { Clock } from "lucide-react";
import type { ServicioPublico } from "../../types";
import { formatPrecio } from "../../utils/formatters";
import { brandSolid, brandTint, DEFAULT_COLOR } from "../../lib/colorUtils";
import FilaSeleccion from "./FilaSeleccion";

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

      <div className="space-y-5">
        {grupos.map((grupo, i) => {
          const idTitulo = `${idBase}-grupo-${i}`;
          return (
            <section key={grupo.clave} aria-labelledby={grupo.titulo ? idTitulo : undefined}>
              {grupo.titulo && (
                <h3 id={idTitulo} className={`mb-2.5 ${claseEncabezado}`}>{grupo.titulo}</h3>
              )}
              {/* Cada servicio es su propia tarjeta: separadas se leen y se tocan como opciones distintas. */}
              <ul className="space-y-2">
                {grupo.servicios.map((servicio) => (
                  <li key={servicio.id}>
                    <FilaSeleccion
                      activo={seleccionado?.id === servicio.id}
                      onSeleccionar={() => onSeleccionar(servicio)}
                      acento={solido}
                      tinte={tinte}
                      titulo={servicio.nombre}
                      descripcion={servicio.descripcion}
                      imagenUrl={servicio.imagenUrl}
                      meta={
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                          <Clock size={11} aria-hidden="true" />
                          {servicio.duracionMinutos} min
                        </span>
                      }
                      valor={
                        <span className="text-base font-bold text-slate-900 tabular-nums">
                          {formatPrecio(servicio.precio)}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
