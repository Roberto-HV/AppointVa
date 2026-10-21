import { useEffect } from "react";

/** Título de `index.html`; lo recupera cada pantalla al desmontarse. */
export const TITULO_POR_DEFECTO = "AppointVa — Tu agenda online. Sin llamadas.";

/**
 * Pone el título de la pestaña ("Iniciar sesión · AppointVa") mientras la
 * pantalla está montada (AP-17, WCAG 2.4.2). Con `null`/vacío no cambia nada,
 * útil mientras carga el nombre del negocio.
 */
export function useTituloPagina(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo) return;
    document.title = `${titulo} · AppointVa`;
    return () => {
      document.title = TITULO_POR_DEFECTO;
    };
  }, [titulo]);
}
