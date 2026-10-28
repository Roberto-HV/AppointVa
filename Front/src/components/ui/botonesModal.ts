// Clases de los botones al pie de un Modal (ver `ModalAcciones`). Mismo alto,
// radio y tipografía para que secundario y principal alineen su línea base.
const BASE =
  "inline-flex items-center justify-center gap-2 min-h-[44px] lg:min-h-[36px] px-4 rounded-xl text-sm " +
  "transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const BOTON_MODAL_SECUNDARIO = `${BASE} border border-border dark:border-slate-600 font-medium text-foreground hover:bg-muted dark:hover:bg-slate-700`;
export const BOTON_MODAL_PRIMARIO = `${BASE} font-semibold bg-primary text-primary-foreground hover:opacity-90`;
export const BOTON_MODAL_PELIGRO = `${BASE} font-semibold bg-red-700 hover:bg-red-800 text-white`;
export const BOTON_MODAL_PELIGRO_SUAVE =
  `${BASE} border border-red-200 dark:border-red-800 font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`;
