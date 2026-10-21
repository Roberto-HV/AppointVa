import { useCallback, useEffect, useRef, useState } from 'react';

export const TIMEOUT_INACTIVIDAD_MS = 60 * 60 * 1000; // 60 minutos
/** El aviso aparece este tiempo antes de cerrar la sesión. */
export const AVISO_INACTIVIDAD_MS = 60 * 1000;
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Cierra la sesión tras 60 min sin actividad, avisando 1 min antes.
 *
 * - Los eventos se escuchan en fase de captura: el panel hace scroll dentro de
 *   `<main class="overflow-y-auto">` y ese `scroll` no burbujea hasta `window`.
 * - Con el aviso a la vista, mover el ratón ya no lo descarta: hay que elegir
 *   "Seguir conectado" (`seguir`), para que el aviso no desaparezca solo.
 */
export function useInactividadTimeout(onTimeout: () => void) {
  const callbackRef = useRef(onTimeout);
  callbackRef.current = onTimeout;
  const [aviso, setAviso] = useState(false);
  const avisoRef = useRef(false);
  const timers = useRef<{ aviso?: ReturnType<typeof setTimeout>; cierre?: ReturnType<typeof setTimeout> }>({});

  // Solo reprograma los temporizadores; el aviso se quita en `seguir`.
  const programar = useCallback(() => {
    clearTimeout(timers.current.aviso);
    clearTimeout(timers.current.cierre);
    timers.current.aviso = setTimeout(() => {
      avisoRef.current = true;
      setAviso(true);
    }, TIMEOUT_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS);
    timers.current.cierre = setTimeout(() => callbackRef.current(), TIMEOUT_INACTIVIDAD_MS);
  }, []);

  useEffect(() => {
    const actividad = () => { if (!avisoRef.current) programar(); };
    programar();
    EVENTS.forEach(e => window.addEventListener(e, actividad, { passive: true, capture: true }));
    const t = timers.current;
    return () => {
      clearTimeout(t.aviso);
      clearTimeout(t.cierre);
      EVENTS.forEach(e => window.removeEventListener(e, actividad, { capture: true }));
    };
  }, [programar]);

  const seguir = useCallback(() => {
    avisoRef.current = false;
    setAviso(false);
    programar();
  }, [programar]);

  return { aviso, seguir };
}
