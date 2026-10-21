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
  texto: string;
  cumple: (valor: string) => boolean;
}

export const LONGITUD_MINIMA_CONTRASENA = 6;

export const REGLAS_CONTRASENA: readonly ReglaContrasena[] = [
  { id: "longitud", texto: `Al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`, cumple: (v) => v.length >= LONGITUD_MINIMA_CONTRASENA },
  { id: "mayuscula", texto: "Una letra mayúscula", cumple: (v) => /[A-Z]/.test(v) },
  { id: "minuscula", texto: "Una letra minúscula", cumple: (v) => /[a-z]/.test(v) },
  { id: "numero", texto: "Un número", cumple: (v) => /[0-9]/.test(v) },
];

/** Esquema zod con las mismas reglas que el servidor. */
export const esquemaContrasena = z
  .string()
  .min(LONGITUD_MINIMA_CONTRASENA, `Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres`)
  .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
  .regex(/[a-z]/, "Debe tener al menos una minúscula")
  .regex(/[0-9]/, "Debe tener al menos un número");

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
 * Se traducen las conocidas; las demás se descartan para no mostrar inglés.
 */
export function traducirErroresIdentity(errores: unknown): string[] {
  if (!Array.isArray(errores)) return [];
  const mensajes = errores
    .filter((e): e is string => typeof e === "string")
    .map((e): string | null => {
      const t = e.toLowerCase();
      if (t.includes("lowercase")) return "La contraseña debe tener al menos una minúscula.";
      if (t.includes("uppercase")) return "La contraseña debe tener al menos una mayúscula.";
      if (t.includes("digit")) return "La contraseña debe tener al menos un número.";
      if (t.includes("non alphanumeric")) return "La contraseña debe tener al menos un símbolo.";
      if (t.includes("unique chars")) return "La contraseña necesita más caracteres distintos.";
      if (t.includes("at least") && t.includes("characters")) return `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`;
      if (t.includes("already taken")) return "Ya existe una cuenta con este correo.";
      return null;
    })
    .filter((m): m is string => m !== null);
  return [...new Set(mensajes)];
}
