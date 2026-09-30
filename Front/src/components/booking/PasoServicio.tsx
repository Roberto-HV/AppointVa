import { useMemo } from "react";
import type { ServicioPublico } from "../../types";
import { formatPrecio } from "../../utils/formatters";
import { getSectorTerms } from "../../hooks/useSectorTerms";
import { brandAccent, brandTint } from "../../lib/colorUtils";
import FilaSeleccion, { GrupoFilas } from "./FilaSeleccion";
import { Clock } from "lucide-react";

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

export default function PasoServicio({ servicios, seleccionado, onSeleccionar, color = "#334155", sector }: Props) {
  const terms = getSectorTerms(sector);
  const acento = useMemo(() => brandAccent(color), [color]);
  const tinte = useMemo(() => brandTint(color), [color]);
  const grupos = useMemo(() => agrupar(servicios), [servicios]);

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">{`¿Qué ${terms.servicio.toLowerCase()} necesitas?`}</h2>
      <p className="text-sm text-slate-500 mb-5">{`Selecciona un ${terms.servicio.toLowerCase()} para continuar`}</p>

      <div className="space-y-5">
        {grupos.map((grupo) => (
          <GrupoFilas key={grupo.clave} titulo={grupo.titulo}>
            {grupo.servicios.map((servicio) => (
              <FilaSeleccion
                key={servicio.id}
                activo={seleccionado?.id === servicio.id}
                onSeleccionar={() => onSeleccionar(servicio)}
                acento={acento}
                tinte={tinte}
                titulo={servicio.nombre}
                descripcion={servicio.descripcion}
                imagenUrl={servicio.imagenUrl}
                meta={
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={11} />
                    {servicio.duracionMinutos} min
                  </span>
                }
                valor={
                  <span className="text-base font-bold text-slate-900">
                    {formatPrecio(servicio.precio)}
                  </span>
                }
              />
            ))}
          </GrupoFilas>
        ))}
      </div>
    </div>
  );
}
