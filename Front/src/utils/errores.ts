// ── Errores de la API ──────────────────────────────────────────────────────────
//
// El backend responde los errores de negocio como `{ mensaje: "..." }`. Cada
// pantalla repetía el mismo cast para leerlo; este es el único sitio que lo hace.

/** Nombre legible de los campos que el backend valida con DataAnnotations. */
const CAMPOS: Record<string, string> = {
  NombreCliente: "el nombre del cliente",
  TelefonoCliente: "el teléfono",
  EmailCliente: "el correo",
  Notas: "la nota",
  InicioEn: "la fecha y hora",
  ServicioId: "el servicio",
  EmpleadoId: "el empleado",
};

/**
 * Primer error de validación de un ProblemDetails de ASP.NET
 * (`{ errors: { Campo: ["The Campo field is required."] } }`), en español.
 * El modelo inválido no pasa por los controladores, así que no trae `mensaje`.
 */
function mensajeValidacion(errors: unknown): string | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  for (const [clave, lista] of Object.entries(errors as Record<string, unknown>)) {
    const texto = Array.isArray(lista) ? lista.find((m) => typeof m === "string" && m.trim()) : undefined;
    if (typeof texto !== "string") continue;
    const campo = clave.replace(/^\$\./, "");
    const etiqueta = CAMPOS[campo] ?? campo;
    if (/field is required/i.test(texto)) return `Falta ${etiqueta}.`;
    if (/maximum length|must be a string .*length/i.test(texto)) return `Revisa ${etiqueta}: excede la longitud permitida.`;
    if (/not a valid e-?mail/i.test(texto)) return "Revisa el formato del correo.";
    // Los mensajes por defecto de DataAnnotations están en inglés: mejor el genérico.
    if (!/^The /.test(texto)) return texto;
  }
  return undefined;
}

/** Mensaje que manda el backend, o el texto por defecto. */
export function mensajeError(err: unknown, porDefecto: string): string {
  const data = (err as { response?: { data?: { mensaje?: unknown; errors?: unknown } } })?.response?.data;
  const mensaje = data?.mensaje;
  if (typeof mensaje === "string" && mensaje.trim()) return mensaje;
  return mensajeValidacion(data?.errors) ?? porDefecto;
}

/** Código HTTP de un error de axios, o `undefined` si no hubo respuesta. */
export function estadoHttp(err: unknown): number | undefined {
  const status = (err as { response?: { status?: unknown } })?.response?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Fallo que puede resolverse solo con reintentar: sin respuesta (red caída),
 * error del servidor (5xx), tiempo agotado (408) o demasiadas peticiones (429).
 * Estas pantallas no deben decir "enlace inválido" ni "verifica tus datos".
 */
export function esErrorTemporal(err: unknown): boolean {
  const status = estadoHttp(err);
  return status === undefined || status >= 500 || status === 408 || status === 429;
}
