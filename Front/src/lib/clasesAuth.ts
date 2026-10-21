// ── Un solo sistema visual para las pantallas de acceso (AP-27) ───────────────
//
// Login y registro usaban `py-3 rounded-xl border-slate-200` y títulos
// `text-2xl font-bold`; recuperar, restablecer y verificar, `py-2.5 rounded-lg
// border-slate-300` y `text-xl font-semibold`. Estas clases son la única fuente.

/** Fondo de página de las pantallas con tarjeta centrada. */
export const FONDO_AUTH = "min-h-screen bg-slate-50 flex items-center justify-center p-4";

export const TARJETA_AUTH = "bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8";

/** El `<h1>` de cada pantalla. */
export const TITULO_AUTH = "text-2xl font-bold text-slate-900 mb-2";

export function campoAuth(conError?: boolean): string {
  return (
    "w-full px-4 py-3 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700 " +
    (conError ? "border-red-400 bg-red-50" : "border-slate-200")
  );
}

export const BOTON_PRIMARIO_AUTH =
  "w-full min-h-[44px] bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm";

export const BOTON_SECUNDARIO_AUTH =
  "min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition";
