// ── Canal de notificaciones que se anuncia en las landings ────────────────────
//
// Decisión 16 (OM-27): no se anuncia WhatsApp hasta que funcione de punta a
// punta. Hoy las confirmaciones, recordatorios y cancelaciones al cliente se
// envían por correo; el propietario las ve en la campana del panel.

export const AVISO_NOTIFICACIONES_CORTO = "Las notificaciones se envían por correo.";

export const AVISO_NOTIFICACIONES = `${AVISO_NOTIFICACIONES_CORTO} Tu cliente recibe la confirmación y el recordatorio de su cita en su email, y tú ves cada cita nueva o cancelada en la campana del panel.`;
