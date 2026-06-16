import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

export function useUnsavedChanges(isDirty: boolean) {
  // Aviso al cerrar/refrescar el navegador
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Aviso al navegar dentro del SPA
  useBlocker(() => {
    if (!isDirty) return false;
    return !window.confirm("Tienes cambios sin guardar. ¿Salir de todas formas?");
  });
}
