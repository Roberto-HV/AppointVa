import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Tiempo mínimo que hay que mantener pulsado (decisión 3: ≥ 1.5 s). */
export const DURACION_PULSACION_LARGA_MS = 1500;

/**
 * Pulsación larga con puntero (ratón, dedo) y con teclado (mantener Enter o
 * Espacio con el botón enfocado). Soltar antes de tiempo cancela.
 */
export function usePulsacionLarga(onCompletar: () => void, duracion = DURACION_PULSACION_LARGA_MS) {
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [presionando, setPresionando] = useState(false);
  const callback = useRef(onCompletar);
  useEffect(() => {
    callback.current = onCompletar;
  }, [onCompletar]);

  const cancelar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setPresionando(false);
  }, []);

  const iniciar = useCallback(() => {
    if (temporizador.current) return;
    setPresionando(true);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      setPresionando(false);
      callback.current();
    }, duracion);
  }, [duracion]);

  useEffect(() => cancelar, [cancelar]);

  const esTeclaActivar = (e: KeyboardEvent) => e.key === "Enter" || e.key === " ";

  return {
    presionando,
    props: {
      onPointerDown: iniciar,
      onPointerUp: cancelar,
      onPointerLeave: cancelar,
      onPointerCancel: cancelar,
      onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
      onKeyDown: (e: KeyboardEvent) => {
        if (!esTeclaActivar(e)) return;
        // Un clic corto con teclado no debe hacer nada: se evita el "click".
        e.preventDefault();
        if (!e.repeat) iniciar();
      },
      onKeyUp: (e: KeyboardEvent) => {
        if (esTeclaActivar(e)) cancelar();
      },
      onBlur: cancelar,
    },
  };
}
