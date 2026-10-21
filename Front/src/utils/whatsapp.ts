import type { CitaDto } from "../types";
import { formatFechaHoraCorta, formatPrecio } from "./formatters";

// Enlaces de WhatsApp del dashboard. Antes cada pantalla armaba su propio
// mensaje; ahora la lista, el inicio y la hoja de acciones usan el mismo.

/** Teléfono en formato internacional para wa.me (México por defecto). */
export function telefonoWhatsApp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("52") && digitos.length >= 12) return digitos;
  return `52${digitos}`;
}

/** Recordatorio de la cita con servicio, profesional, fecha, total y enlace. */
export function urlRecordatorioWhatsApp(cita: CitaDto, nombreNegocio?: string | null): string {
  const negocio = nombreNegocio ? ` en *${nombreNegocio}*` : "";
  const msg =
    `Hola ${cita.nombreCliente} 👋, te recordamos tu cita${negocio}:\n\n` +
    `📌 *Servicio:* ${cita.nombreServicio}\n` +
    `👤 *Con:* ${cita.nombreEmpleado}\n` +
    `📅 *Fecha:* ${formatFechaHoraCorta(cita.inicioEn)}\n` +
    `💰 *Total:* ${formatPrecio(cita.precio)}\n` +
    `🔖 *Código:* ${cita.codigoConfirmacion}\n\n` +
    `🔗 Ver tu cita: ${window.location.origin}/cita/${cita.codigoConfirmacion}\n\n` +
    `¡Te esperamos!`;
  return `https://wa.me/${telefonoWhatsApp(cita.telefonoCliente)}?text=${encodeURIComponent(msg)}`;
}

/** Solicitud de reseña tras una cita completada. */
export function urlResenaWhatsApp(cita: CitaDto, nombreNegocio?: string | null, slug?: string | null): string {
  const negocio = nombreNegocio ? `*${nombreNegocio}*` : "nuestro negocio";
  const enlace = slug ? `${window.location.origin}/b/${slug}` : window.location.origin;
  const nombre = cita.nombreCliente.split(" ")[0];
  const msg =
    `Hola ${nombre} 😊, fue un placer atenderte en ${negocio}.\n\n` +
    `Tu opinión nos ayuda a mejorar y a que más personas conozcan nuestro trabajo. ` +
    `¿Podrías dejarnos una reseña?\n\n` +
    `👉 ${enlace}\n\n` +
    `¡Muchas gracias! 🌟`;
  return `https://wa.me/${telefonoWhatsApp(cita.telefonoCliente)}?text=${encodeURIComponent(msg)}`;
}
