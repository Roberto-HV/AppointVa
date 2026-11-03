// Clases compartidas por las piezas del área de negocios del SuperAdmin: la
// lista, la ficha, Facturación y sus modales. Antes vivían arriba de
// `NegociosAdminPage`; al dividir la página (lote 4) se movieron aquí tal cual.

/**
 * Base de los botones de acción de la tarjeta de negocio.
 *
 * Mismo tratamiento que las acciones de Empleados: el tinte claro del borde es
 * también el relleno, no blanco. Con siete botones blancos de cinco colores de
 * borde distintos la tarjeta se leía como un semáforo; con el tinte, el color
 * informa sin gritar. El alto sigue el mínimo táctil de 44px y baja a 36px en
 * escritorio, igual que `BotonAccion`, `Tabs` y `Pagination`.
 */
export const ACCION_TARJETA =
  "min-h-[44px] lg:min-h-[36px] px-2 rounded-md border text-xs font-medium " +
  "inline-flex items-center justify-center gap-1.5 text-center transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 " +
  "dark:focus-visible:ring-accent-brand/40 disabled:opacity-50 disabled:cursor-not-allowed";

/** Tintes de las acciones: los mismos en la tarjeta y en la ficha del negocio. */
export const TINTE_SUSCRIPCION =
  "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-950";
export const TINTE_DESACTIVAR =
  "border-red-300 bg-red-50 text-red-600 hover:border-red-500 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950";
export const TINTE_ACTIVAR =
  "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950";
export const TINTE_PROPIETARIO =
  "border-blue-300 bg-blue-50 text-blue-600 hover:border-blue-500 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-950";

/** Campo de texto de los modales: mismo alto táctil y mismo modo oscuro. */
export const CAMPO_MODAL =
  "w-full min-h-[44px] px-3 py-2 rounded-lg border text-sm outline-none transition-colors " +
  "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 " +
  "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
  "focus:border-accent-brand dark:focus:border-accent-brand";
export const CAMPO_OK = "border-slate-200 dark:border-slate-600";
export const CAMPO_ERROR = "border-red-400 bg-red-50 dark:bg-red-950/30";

/** Clave compartida por activar/desactivar, para saber qué negocios están en curso. */
export const CLAVE_ESTADO_NEGOCIO = ["admin", "estado-negocio"] as const;

/** Par de botones al pie de los modales. El primario es el mismo `slate-700`
 *  que `BotonAccion`, para que el panel no mantenga su propio negro. */
export const BOTON_PIE =
  "flex-1 min-h-[44px] lg:min-h-[36px] px-4 rounded-xl text-sm transition-colors disabled:opacity-50 " +
  "disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40";
export const BOTON_PIE_SECUNDARIO =
  `${BOTON_PIE} border-2 font-medium border-slate-200 dark:border-slate-600 ` +
  "text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500";
export const BOTON_PIE_PRIMARIO =
  `${BOTON_PIE} font-semibold bg-slate-700 hover:bg-slate-800 text-white ` +
  "dark:bg-slate-600 dark:hover:bg-slate-500";

/** Superficie de tarjeta del área: borde y sin sombra, como `.tarjeta`. */
export const SUPERFICIE = "bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700";
