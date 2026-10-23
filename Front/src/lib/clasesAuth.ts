// ── Un solo sistema visual para las pantallas de acceso (AP-27) ───────────────
//
// Login y registro usaban `py-3 rounded-xl border-slate-200` y títulos
// `text-2xl font-bold`; recuperar, restablecer y verificar, `py-2.5 rounded-lg
// border-slate-300` y `text-xl font-semibold`. Estas clases son la única fuente.

/** Fondo de página de las pantallas con tarjeta centrada. */
export const FONDO_AUTH = "min-h-screen bg-slate-50 flex items-center justify-center p-4";

/** Tarjeta base (.tarjeta en src/index.css): radio 14px y sombra suave, sin borde. */
export const TARJETA_AUTH = "tarjeta p-6 sm:p-8";

/** El `<h1>` de cada pantalla. */
export const TITULO_AUTH = "text-2xl font-bold text-slate-900 mb-2";

export function campoAuth(conError?: boolean): string {
  return (
    "w-full px-4 py-3 rounded-lg border text-sm outline-none transition focus:ring-2 focus:ring-accent-brand/30 focus:border-accent-brand " +
    (conError ? "border-red-400 bg-red-50" : "border-slate-200")
  );
}

export const BOTON_PRIMARIO_AUTH =
  "w-full min-h-[44px] bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-semibold py-3 rounded-lg transition text-sm";

export const BOTON_SECUNDARIO_AUTH =
  "min-h-[44px] px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition";
