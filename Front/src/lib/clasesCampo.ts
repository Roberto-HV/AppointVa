// ── Clases de los campos de formulario del panel ───────────────────────────────
//
// Antes cada campo ponía `dark:border-slate-600` siempre, y esa clase gana a
// `border-red-400`: en dark mode un campo inválido se veía normal. Aquí el borde
// oscuro solo va en la rama sin error, y el error tiene su propio par oscuro.

const BASE =
  "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-slate-700 dark:focus:border-slate-400 dark:bg-slate-800 dark:text-slate-100";

/** Clases de un `<input>`/`<textarea>`; con error, el borde rojo gana en los dos temas. */
export function claseCampo(conError: boolean, extra = ""): string {
  const estado = conError
    ? "border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950/30"
    : "border-slate-200 dark:border-slate-600";
  return `${BASE} ${estado}${extra ? ` ${extra}` : ""}`;
}

/** Texto de error bajo un campo. */
export const CLASE_ERROR_CAMPO = "text-red-700 dark:text-red-400 text-xs mt-1";
