import { useEffect, useState } from "react";

/**
 * La hora actual, renovada cada minuto. Con `fijo` (pruebas) devuelve esa
 * fecha y no programa nada. Úsalo una vez por pantalla y pásalo hacia abajo
 * para que todo lo que depende de "ahora" diga lo mismo.
 */
export function useAhora(fijo?: Date, cadaMs = 60_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  const fijoMs = fijo?.getTime();
  useEffect(() => {
    if (fijoMs !== undefined) return;
    const id = setInterval(() => setAhora(new Date()), cadaMs);
    return () => clearInterval(id);
  }, [fijoMs, cadaMs]);
  return fijoMs !== undefined ? new Date(fijoMs) : ahora;
}
