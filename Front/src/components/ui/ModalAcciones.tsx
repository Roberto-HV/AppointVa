import type { ReactNode } from "react";

/**
 * Fila de botones al pie de un Modal: apilados a todo el ancho en móvil (el
 * principal arriba), alineados a la derecha en escritorio con el principal al
 * final. Los hijos van en orden de lectura: secundario(s) primero, principal último.
 * `apilado` mantiene la columna también en escritorio, para tres acciones en
 * un modal estrecho donde no caben en una fila.
 */
export default function ModalAcciones({ children, className = "", apilado = false }: {
  children: ReactNode;
  className?: string;
  apilado?: boolean;
}) {
  const fila = apilado
    ? "[&>*]:w-full"
    : "sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto sm:[&>*]:flex-none";
  return (
    <div className={`flex flex-col-reverse gap-2 pt-1 ${fila} ${className}`}>
      {children}
    </div>
  );
}
