import { useEffect, useRef } from 'react';

const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export function useInactividadTimeout(onTimeout: () => void) {
  const callbackRef = useRef(onTimeout);
  callbackRef.current = onTimeout;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), TIMEOUT_MS);
    }

    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));

    return () => {
      clearTimeout(timer);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, []);
}
