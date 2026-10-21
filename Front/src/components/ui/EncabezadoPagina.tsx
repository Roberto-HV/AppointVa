import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { AccionesPagina } from "./BotonAccion";

interface EncabezadoPaginaProps {
  /** Título de la página. Es el único `h1` de la vista. */
  titulo: ReactNode;
  /** Bajada bajo el título. Admite nodos porque varias páginas intercalan contadores. */
  subtitulo?: ReactNode;
  /** Botones y enlaces de acción. Van dentro de `AccionesPagina`, no hace falta envolverlos. */
  acciones?: ReactNode;
  /** Mismo hueco que `acciones`, para contenido que es dato y no acción (el promedio de Reseñas). */
  complemento?: ReactNode;
  className?: string;
}

/**
 * Encabezado de página del dashboard: título, bajada y el hueco de acciones.
 *
 * Cada página armaba su propia fila y había cinco combinaciones distintas de
 * clases para la misma pieza —`items-center` contra `items-start`, con y sin
 * `flex-wrap`, cuatro separaciones—. Eso no era solo desorden: `flex-wrap` sin
 * un ancho máximo para el título es justo lo que bajaba el botón a una segunda
 * línea en cuanto dejaba de caber.
 *
 * Aquí la fila nunca envuelve. El bloque del título lleva `min-w-0 flex-1`, así
 * que es él quien cede ancho y reparte su texto en más líneas; las acciones
 * conservan su sitio a la derecha porque `AccionesPagina` es `shrink-0`. Es la
 * forma que el dueño señaló en Reportes: bajada de dos líneas a la izquierda y
 * un botón de una sola línea a su derecha, con los bordes superiores alineados
 * gracias a `items-start`.
 *
 * El margen inferior lo pone cada página por `className`: unas viven dentro de
 * un `space-y-*` y no necesitan ninguno.
 */
export default function EncabezadoPagina({
  titulo,
  subtitulo,
  acciones,
  complemento,
  className,
}: EncabezadoPaginaProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{titulo}</h1>
        {subtitulo && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitulo}</p>
        )}
      </div>
      {acciones && <AccionesPagina>{acciones}</AccionesPagina>}
      {complemento && <div className="shrink-0">{complemento}</div>}
    </div>
  );
}
