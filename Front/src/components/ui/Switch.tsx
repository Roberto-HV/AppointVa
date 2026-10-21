import type { KeyboardEvent } from "react";

interface Props {
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  /** Nombre accesible cuando no hay un texto visible enlazado con `idEtiqueta`. */
  etiqueta?: string;
  /** Id del texto visible que nombra el interruptor (se usa como `aria-labelledby`). */
  idEtiqueta?: string;
  /** Id del texto que explica qué hace (se usa como `aria-describedby`). */
  idDescripcion?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Interruptor de encendido/apagado.
 *
 * Antes cada pantalla dibujaba el suyo con un `div` y `onClick`: no recibía foco,
 * no se anunciaba ni se podía cambiar con el teclado, y solo respondía el riel de
 * 20 px. Este es un `<button role="switch">`: Espacio y Enter lo cambian (los da
 * el propio botón), anuncia su estado con `aria-checked` y el área táctil mide
 * 44 px aunque el riel se vea más pequeño.
 */
export default function Switch({
  activo, onCambiar, etiqueta, idEtiqueta, idDescripcion, disabled = false, id, className = "",
}: Props) {
  // Un `<button>` ya convierte Espacio y Enter en clic. Las flechas son un extra
  // habitual en los interruptores: derecha enciende, izquierda apaga.
  const alPulsarTecla = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowRight" && !activo) { e.preventDefault(); onCambiar(true); }
    if (e.key === "ArrowLeft" && activo) { e.preventDefault(); onCambiar(false); }
  };

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={activo}
      aria-label={idEtiqueta ? undefined : etiqueta}
      aria-labelledby={idEtiqueta}
      aria-describedby={idDescripcion}
      disabled={disabled}
      onClick={() => onCambiar(!activo)}
      onKeyDown={alPulsarTecla}
      className={`group relative inline-flex shrink-0 items-center justify-center min-w-[44px] min-h-[44px] rounded-full
        focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-block w-11 h-6 rounded-full transition-colors
          group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background
          ${activo ? "bg-primary" : "bg-gray-300 dark:bg-slate-600"}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full shadow transition-transform motion-reduce:transition-none
            ${activo ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-white"}`}
        />
      </span>
    </button>
  );
}
