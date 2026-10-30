import type { ReactNode } from "react";
import { useVarianteModal } from "./varianteModal";

/**
 * Fila de botones al pie de un Modal: apilados a todo el ancho en móvil (el
 * principal arriba), alineados a la derecha en escritorio con el principal al
 * final. Los hijos van en orden de lectura: secundario(s) primero, principal último.
 * `apilado` mantiene la columna también en escritorio, para tres acciones en
 * un modal estrecho donde no caben en una fila.
 *
 * Dentro de la hoja inferior del teléfono (I13) el pie queda fijo abajo
 * (`sticky`) con su propio fondo y la zona segura del iPhone: en un formulario
 * largo la acción principal sigue al alcance del pulgar sin bajar hasta el final.
 * Por eso conviene que sea el último hijo del formulario o del cuerpo.
 */
export default function ModalAcciones({ children, className = "", apilado = false }: {
  children: ReactNode;
  className?: string;
  apilado?: boolean;
}) {
  const hoja = useVarianteModal() === "hoja";
  const fila = apilado
    ? "[&>*]:w-full"
    : "sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto sm:[&>*]:flex-none";
  const fijo = hoja
    ? "sticky bottom-0 z-10 -mx-5 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] -mb-[calc(1.25rem+env(safe-area-inset-bottom))] " +
      "bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700"
    : "pt-1";
  return (
    <div data-pie-modal={hoja ? "fijo" : undefined} className={`flex flex-col-reverse gap-2 ${fijo} ${fila} ${className}`}>
      {children}
    </div>
  );
}
