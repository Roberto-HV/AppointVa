// URL del .ics de una cita para "Apple Calendar".
//
// Se arma con la misma base del API que usa el front (VITE_API_URL) y no con la
// `icalUrl` que devuelve el servidor: esa sale de la configuración `BackendUrl`
// del backend, que en local apuntaba a un puerto donde no corre el API y en
// producción podía duplicar "/api". Además es https y no webcal://: webcal crea
// una *suscripción* (Calendar la vuelve a pedir periódicamente y falla si el API
// tarda en despertar); un .ics por https servido en línea abre en iOS y macOS la
// vista "Agregar al calendario" de un solo evento.

/** Base absoluta del API: VITE_API_URL tal cual, o resuelta contra el origen si es relativa ("/api"). */
export function baseApiAbsoluta(
  apiBase: string | undefined = import.meta.env.VITE_API_URL,
  origen: string = window.location.origin
): string {
  const base = (apiBase && apiBase.trim()) || "/api";
  const absoluta = /^https?:\/\//i.test(base) ? base : new URL(base, origen).toString();
  return absoluta.replace(/\/+$/, "");
}

export function urlIcalCita(codigo: string, apiBase?: string, origen?: string): string {
  return `${baseApiAbsoluta(apiBase, origen)}/publico/citas/${encodeURIComponent(codigo)}/ical`;
}
