// ── Activación de un negocio nuevo ────────────────────────────────────────────
//
// Una sola fuente para lo que se le dice al propietario sobre la activación
// (AP-02). Lo usan la pantalla de registro exitoso, la FAQ de la landing y el
// aviso del panel, para que las tres cuenten lo mismo.
//
// Comportamiento real del backend (PublicoController.RegistrarNegocio y
// NegociosController.Activar):
// - El negocio se crea con `Activo = 0`; un SuperAdmin lo activa a mano.
// - Mientras está inactivo, la página pública /b/{slug} no carga ni acepta citas,
//   pero el propietario sí puede entrar al panel (tras confirmar su correo).
// - El enlace de verificación vence en 24 horas.
// - Activar el negocio NO envía ningún correo; el propietario lo ve porque el
//   aviso del panel desaparece. Por eso aquí no se promete un aviso por correo
//   ni un plazo concreto: no hay nada en el sistema que los garantice.

export const CORREO_SOPORTE = "hola@appointva.com";

/** Frase central: idéntica en las tres superficies. */
export const ACTIVACION_RESUMEN =
  "Nuestro equipo revisa y activa cada negocio de forma manual. Hasta entonces tu página de reservas no recibe citas, pero ya puedes configurar servicios y horarios desde tu panel.";

/**
 * Pasos de la pantalla "Revisa tu correo". El paso 3 ya cuenta la activación
 * manual, así que esa pantalla no repite `ACTIVACION_RESUMEN` debajo.
 */
export const ACTIVACION_PASOS = [
  "Confirma tu correo con el enlace que te enviamos. Vence en 24 horas.",
  "Inicia sesión y configura tus servicios, horarios y equipo.",
  "Activamos tu negocio de forma manual. Mientras siga pendiente, tu página de reservas no recibe citas y verás un aviso en tu panel.",
] as const;

export const ACTIVACION_FAQ = `Primero confirma tu correo con el enlace que te enviamos. ${ACTIVACION_RESUMEN} Mientras tu negocio esté pendiente verás un aviso en tu panel; si tienes dudas, escríbenos a ${CORREO_SOPORTE}. No se requiere tarjeta de crédito.`;
