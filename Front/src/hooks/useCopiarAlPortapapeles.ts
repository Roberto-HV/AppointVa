import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copia un texto al portapapeles y marca `copiado` durante `ms` milisegundos.
 * Devuelve `false` si el portapapeles no está o falla, para que quien llama
 * decida qué ofrecer a cambio.
 */
export function useCopiarAlPortapapeles(ms = 2000) {
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const copiar = useCallback(async (texto: string): Promise<boolean> => {
    if (!texto) return false;
    try {
      if (!navigator.clipboard) return false;
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(false), ms);
      return true;
    } catch {
      return false;
    }
  }, [ms]);

  return { copiado, copiar };
}
