import { createContext, useContext } from "react";

/** "hoja": hoja inferior del teléfono. "dialogo": diálogo centrado de escritorio. */
export type VarianteModal = "hoja" | "dialogo";

// Aparte de `Modal` para que `ModalAcciones` no dependa del módulo del diálogo:
// varias pruebas sustituyen `Modal` por un doble y el pie debe seguir funcionando.
export const VarianteModalContext = createContext<VarianteModal>("dialogo");

/** Variante del `Modal` que envuelve al componente (p. ej. `ModalAcciones` se fija abajo en la hoja). */
export function useVarianteModal(): VarianteModal {
  return useContext(VarianteModalContext);
}
