import { z } from "zod";

// ── Reglas de contraseña ──────────────────────────────────────────────────────
//
// Copia exacta de las opciones de ASP.NET Identity del backend (Program.cs):
//   RequiredLength = 6, RequireUppercase = true, RequireDigit = true,
//   RequireNonAlphanumeric = false.
// `RequireLowercase` no se configura, así que vale su valor por defecto (true):
// el servidor exige una minúscula. Antes el cliente no la pedía y aceptaba
// contraseñas como "CLAVE123" que el servidor rechazaba después (AP-12).
// Si cambian las opciones en Program.cs, hay que cambiar esta lista.

export interface ReglaContrasena {
  id: "longitud" | "mayuscula" | "minuscula" | "numero";
  /** Texto del checklist (`ReglasContrasena`). */
  texto: string;
  /** Mensaje de validación del formulario cuando la regla no se cumple. */
  error: string;
  /** Traducción del error equivalente de Identity (`errores` del servidor). */
  errorServidor: string;
  /** Fragmento que identifica la descripción en inglés de Identity. */
  claveIdentity: string;
  cumple: (valor: string) => boolean;
}

export const LONGITUD_MINIMA_CONTRASENA = 6;

/**
 * Única definición de las reglas. De aquí salen el checklist, el esquema zod
 * y la traducción de los errores de Identity, para que no se desalineen.
 */
export const REGLAS_CONTRASENA: readonly ReglaContrasena[] = [
  {
    id: "longitud",
    texto: `Al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
    error: `Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
    errorServidor: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
    claveIdentity: "must be at least",
    cumple: (v) => v.length >= LONGITUD_MINIMA_CONTRASENA,
  },
  {
    id: "mayuscula",
    texto: "Una letra mayúscula",
    error: "Debe tener al menos una mayúscula",
    errorServidor: "La contraseña debe tener al menos una mayúscula.",
    claveIdentity: "uppercase",
    cumple: (v) => /[A-Z]/.test(v),
  },
  {
    id: "minuscula",
    texto: "Una letra minúscula",
    error: "Debe tener al menos una minúscula",
    errorServidor: "La contraseña debe tener al menos una minúscula.",
    claveIdentity: "lowercase",
    cumple: (v) => /[a-z]/.test(v),
  },
  {
    id: "numero",
    texto: "Un número",
    error: "Debe tener al menos un número",
    errorServidor: "La contraseña debe tener al menos un número.",
    claveIdentity: "digit",
    cumple: (v) => /[0-9]/.test(v),
  },
];

/** Esquema zod con las mismas reglas que el servidor, en el orden de la lista. */
export const esquemaContrasena = z.string().superRefine((valor, ctx) => {
  for (const regla of REGLAS_CONTRASENA) {
    if (!regla.cumple(valor)) ctx.addIssue({ code: "custom", message: regla.error });
  }
});

export function cumpleReglasContrasena(valor: string): boolean {
  return REGLAS_CONTRASENA.every((r) => r.cumple(valor));
}

/**
 * Puntaje 0–4 para el medidor. Cumplir las reglas mínimas no hace fuerte una
 * contraseña: "Password1" queda en "Regular". Suben el puntaje la longitud y
 * los símbolos.
 */
export function puntajeContrasena(valor: string): number {
  if (!valor) return 0;
  if (!cumpleReglasContrasena(valor)) return 1;
  let s = 2;
  if (valor.length >= 10) s++;
  if (valor.length >= 14 || /[^A-Za-z0-9]/.test(valor)) s++;
  return Math.min(s, 4);
}

/**
 * El backend devuelve en `errores` las descripciones de Identity en inglés.
 * Se traducen las de las reglas configuradas (y el correo duplicado); las demás
 * se descartan para no mostrar inglés. No se traducen "non alphanumeric" ni
 * "unique chars": Program.cs no exige ninguna de las dos, así que el servidor
 * no puede devolverlas.
 */
export function traducirErroresIdentity(errores: unknown): string[] {
  if (!Array.isArray(errores)) return [];
  const mensajes = errores
    .filter((e): e is string => typeof e === "string")
    .map((e): string | null => {
      const t = e.toLowerCase();
      if (t.includes("already taken")) return "Ya existe una cuenta con este correo.";
      return REGLAS_CONTRASENA.find((r) => t.includes(r.claveIdentity))?.errorServidor ?? null;
    })
    .filter((m): m is string => m !== null);
  return [...new Set(mensajes)];
}
