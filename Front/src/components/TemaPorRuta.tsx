import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { aplicarTemaDeRuta, rutaAdmiteTemaOscuro } from "../lib/temaPorRuta";

/**
 * Mantiene `.dark` fuera de las páginas públicas al navegar del lado del cliente.
 * Corre en layout effect para que el cambio de tema no se vea un cuadro tarde; el
 * `useTheme` del layout del panel sigue controlando el interruptor dentro del panel.
 */
export default function TemaPorRuta() {
  const { pathname } = useLocation();
  const admiteOscuro = rutaAdmiteTemaOscuro(pathname);

  useLayoutEffect(() => {
    aplicarTemaDeRuta(pathname);
    // Solo importa cruzar la frontera panel ↔ público, no cada cambio de ruta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admiteOscuro]);

  return null;
}
