import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DialogoDescartarCambios from "../components/ui/DialogoDescartarCambios";
import { useUnsavedChanges } from "./useUnsavedChanges";

// ── Cambios sin guardar ───────────────────────────────────────────────────────
//
// Un Escape, un clic fuera del modal o un enlace del menú lateral descartaban
// sin aviso un horario de siete días o las notas de un cliente. Aquí vive la
// única forma de preguntar antes: los modales piden el cierre con
// `useConfirmarDescarte`, y las páginas largas (Mi negocio) protegen además la
// navegación dentro de la app con `useProtegerNavegacion`.

/**
 * Para modales con formulario:
 *
 *   const descarte = useConfirmarDescarte();
 *   <Modal onCerrar={() => descarte.pedirCierre(isDirty, () => setAbierto(false))}>
 *   {descarte.dialogo}
 *
 * Sin cambios cierra al instante; con cambios pregunta primero.
 */
export function useConfirmarDescarte(): {
  pedirCierre: (hayCambios: boolean, cerrar: () => void) => void;
  dialogo: ReactNode;
} {
  const [cierrePendiente, setCierrePendiente] = useState<(() => void) | null>(null);

  const pedirCierre = useCallback((hayCambios: boolean, cerrar: () => void) => {
    if (!hayCambios) { cerrar(); return; }
    // Función dentro de función: `setState(fn)` llamaría a `cerrar`.
    setCierrePendiente(() => cerrar);
  }, []);

  const dialogo = (
    <DialogoDescartarCambios
      abierto={cierrePendiente !== null}
      onDescartar={() => {
        const cerrar = cierrePendiente;
        setCierrePendiente(null);
        cerrar?.();
      }}
      onVolver={() => setCierrePendiente(null)}
    />
  );

  return { pedirCierre, dialogo };
}

/**
 * Para páginas con cambios sin guardar: avisa al cerrar o recargar la pestaña
 * y, dentro de la app, al seguir cualquier enlace interno (menú lateral, logo,
 * enlaces del contenido).
 *
 * El router es un `BrowserRouter`, sin `useBlocker`, así que se intercepta el
 * clic en fase de captura antes de que llegue al `<Link>`. No cubre las
 * navegaciones por código (`navigate()`), que hoy solo usan el menú de usuario y
 * las notificaciones.
 */
export function useProtegerNavegacion(hayCambios: boolean): ReactNode {
  const navigate = useNavigate();
  const location = useLocation();
  const [destino, setDestino] = useState<string | null>(null);
  const rutaActual = location.pathname + location.search + location.hash;

  useUnsavedChanges(hayCambios);

  useEffect(() => {
    if (!hayCambios) return;
    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace || (enlace.target && enlace.target !== "_self") || enlace.hasAttribute("download")) return;
      const url = new URL(enlace.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const ruta = url.pathname + url.search + url.hash;
      if (ruta === rutaActual) return;
      e.preventDefault();
      e.stopPropagation();
      setDestino(ruta);
    };
    document.addEventListener("click", alHacerClic, true);
    return () => document.removeEventListener("click", alHacerClic, true);
  }, [hayCambios, rutaActual]);

  return (
    <DialogoDescartarCambios
      abierto={destino !== null}
      onDescartar={() => {
        const ruta = destino;
        setDestino(null);
        if (ruta) navigate(ruta);
      }}
      onVolver={() => setDestino(null)}
    />
  );
}
