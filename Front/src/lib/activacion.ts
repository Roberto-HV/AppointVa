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
// - Activar el negocio NO envía ningún correo (verificado en el backend; el
//   correo de activación es B21). El propietario lo ve porque el aviso del panel
//   desaparece, así que aquí no se promete un aviso por correo.
// - Decisión 1 (AP-02): el equipo se compromete a activar en menos de 24 horas
//   hábiles; ese plazo es un compromiso operativo, no algo que aplique el sistema.

export const CORREO_SOPORTE = "hola@appointva.com";

/** Plazo comprometido de activación, en horas hábiles (decisión 1, AP-02). */
export const ACTIVACION_PLAZO_HORAS = 24;
export const ACTIVACION_PLAZO = `en menos de ${ACTIVACION_PLAZO_HORAS} horas hábiles`;

/**
 * Cómo se entera el propietario: la misma frase en la FAQ y en el aviso del
 * panel. Sin correo de activación en el backend (B21).
 */
export const ACTIVACION_AVISO = "El aviso de activación pendiente de tu panel desaparece cuando tu negocio esté activo.";

/** Frase central: idéntica en las tres superficies. */
export const ACTIVACION_RESUMEN =
  `Nuestro equipo revisa y activa cada negocio de forma manual, ${ACTIVACION_PLAZO}. Hasta entonces tu página de reservas no recibe citas, pero ya puedes configurar servicios y horarios desde tu panel.`;

/**
 * Pasos de la pantalla "Revisa tu correo". El paso 3 ya cuenta la activación
 * manual, así que esa pantalla no repite `ACTIVACION_RESUMEN` debajo.
 */
export const ACTIVACION_PASOS = [
  "Confirma tu correo con el enlace que te enviamos. Vence en 24 horas.",
  "Inicia sesión y configura tus servicios, horarios y equipo.",
  `Activamos tu negocio de forma manual, ${ACTIVACION_PLAZO}. Mientras siga pendiente, tu página de reservas no recibe citas y verás un aviso en tu panel, que desaparece cuando tu negocio esté activo.`,
] as const;

export const ACTIVACION_FAQ = `Primero confirma tu correo con el enlace que te enviamos. ${ACTIVACION_RESUMEN} ${ACTIVACION_AVISO} Si tienes dudas, escríbenos a ${CORREO_SOPORTE}. No se requiere tarjeta de crédito.`;
