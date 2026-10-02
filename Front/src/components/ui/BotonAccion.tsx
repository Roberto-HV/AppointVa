import { Link, type LinkProps } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Acción del encabezado de página: arriba a la derecha, junto al título.
 *
 * Había una variante por pantalla —`bg-gray-900` en Galería, `rounded-xl` en
 * Descuentos y Cuestionario, `rounded-lg` en Empleados y Servicios, `text-xs`
 * con borde en Clientes— y ninguna con clases `dark:`. Aquí viven el tamaño, el
 * relleno, el radio y el foco una sola vez.
 *
 * Dos variantes y no una: crear un registro ("+ Nuevo servicio") y exportar lo
 * que ya existe no pesan igual, y pintarlas iguales le da a la exportación una
 * prominencia que no le corresponde. Tampoco más de dos: ninguna acción de este
 * hueco es destructiva ni necesita un tercer nivel.
 *
 * El tamaño es el mismo en las dos para que al alternar entre páginas el botón
 * no salte: `min-h-[44px]` cumple el mínimo táctil en móvil y baja a 36px en
 * escritorio, igual que `Pagination`, `Tabs` y `FiltroBarra`.
 */
type Variante = "primaria" | "secundaria";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap " +
  "min-h-[44px] lg:min-h-[36px] px-3.5 rounded-lg text-sm font-semibold " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-slate-700/40 dark:focus-visible:ring-slate-400/40 " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const VARIANTES: Record<Variante, string> = {
  primaria:
    "bg-slate-700 hover:bg-slate-800 text-white " +
    "dark:bg-slate-600 dark:hover:bg-slate-500",
  secundaria:
    "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 " +
    "border border-gray-200 dark:border-slate-600 " +
    "hover:bg-gray-50 dark:hover:bg-slate-700 " +
    "hover:border-gray-300 dark:hover:border-slate-500",
};

export function clasesBotonAccion(variante: Variante = "primaria", className?: string) {
  return cn(BASE, VARIANTES[variante], className);
}

interface BotonAccionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  children: ReactNode;
}

export default function BotonAccion({
  variante = "primaria",
  className,
  type = "button",
  children,
  ...rest
}: BotonAccionProps) {
  return (
    <button type={type} className={clasesBotonAccion(variante, className)} {...rest}>
      {children}
    </button>
  );
}

interface EnlaceAccionProps extends LinkProps {
  variante?: Variante;
  children: ReactNode;
}

/** Misma pieza cuando la acción navega en vez de ejecutar (Recepción en Citas). */
export function EnlaceAccion({
  variante = "secundaria",
  className,
  children,
  ...rest
}: EnlaceAccionProps) {
  return (
    <Link className={clasesBotonAccion(variante, className)} {...rest}>
      {children}
    </Link>
  );
}

/**
 * Contenedor del hueco de acciones. `flex-wrap` + `justify-end` es lo que evita
 * que dos acciones se pisen o desborden a 390px: si no caben en la fila del
 * título, bajan alineadas a la derecha en vez de recortarse.
 *
 * `ml-auto` sostiene la posición que pidió el dueño —arriba a la derecha— también
 * cuando el bloque baja de línea: en una línea propia el margen automático se
 * come el espacio libre y lo deja pegado al borde derecho, no al izquierdo.
 */
export function AccionesPagina({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 ml-auto", className)}>
      {children}
    </div>
  );
}
