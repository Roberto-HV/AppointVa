// ── Tema por ruta ──────────────────────────────────────────────────────────────
//
// Solo el panel (dashboard y admin) respeta el tema claro/oscuro del usuario.
// Las páginas públicas (reserva, confirmación, landing, auth, legales) son solo
// claras: no tienen variantes `dark:` y un `.dark` heredado pintaba el documento
// oscuro alrededor de tarjetas claras.
//
// `index.html` replica esta regla en su script de arranque para el primer pintado;
// si cambia aquí, cambia allá.

export type Tema = "light" | "dark";

export const CLAVE_TEMA = "appointva-theme";

const RUTAS_CON_TEMA = /^\/(dashboard|admin)(\/|$)/;

export function rutaAdmiteTemaOscuro(pathname: string): boolean {
  return RUTAS_CON_TEMA.test(pathname);
}

/** Preferencia guardada o, si no hay, la del sistema operativo. */
export function temaPreferido(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    if (guardado === "dark" || guardado === "light") return guardado;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    // Almacenamiento bloqueado: se queda en claro.
  }
  return "light";
}

export function aplicarTemaDeRuta(pathname: string): void {
  const root = document.documentElement;
  if (rutaAdmiteTemaOscuro(pathname)) {
    root.classList.toggle("dark", temaPreferido() === "dark");
    // El panel conserva su comportamiento previo: sin color-scheme forzado.
    root.style.colorScheme = "";
  } else {
    root.classList.remove("dark");
    // Controles nativos, scrollbars y overscroll también en claro.
    root.style.colorScheme = "light";
  }
}
