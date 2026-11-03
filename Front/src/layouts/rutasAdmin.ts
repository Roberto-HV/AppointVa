/** Mi cuenta del SuperAdmin: datos y cambio de contraseña (Lote 1, G1). */
export const RUTA_CUENTA_ADMIN = "/admin/cuenta";

/** Verificación en dos pasos del SuperAdmin: la misma `DosFactoresPage` del panel. */
export const RUTA_SEGURIDAD_ADMIN = "/admin/seguridad";

/** Lista de negocios: la portada del admin. */
export const RUTA_NEGOCIOS_ADMIN = "/admin";

/** Facturación, con su propia entrada en el menú (Lote 4, M2). */
export const RUTA_FACTURACION_ADMIN = "/admin/facturacion";

/** Ficha de un negocio (Lote 4, I1). */
export const RUTA_NEGOCIO_ADMIN = "/admin/negocios/:id";

/** Secciones de la ficha; van en `?seccion=` para poder enlazar una directamente. */
export type SeccionNegocio = "resumen" | "suscripcion" | "propietario" | "configuracion" | "actividad";

export const rutaNegocioAdmin = (id: string, seccion?: SeccionNegocio) =>
  `/admin/negocios/${encodeURIComponent(id)}${seccion && seccion !== "resumen" ? `?seccion=${seccion}` : ""}`;
