import type { AxiosProgressEvent, AxiosRequestConfig } from "axios";

// ── Reglas de subida de imágenes ───────────────────────────────────────────────
//
// Una sola regla para todos los subidores (logo, portada, políticas, galería,
// foto de empleado, imagen de servicio). Los formatos son los que acepta el
// backend (`BlobStorageService`: JPEG, PNG, WebP, GIF). El backend corta en
// 20 MB; aquí el tope es 10 MB para que una foto de teléfono sin comprimir se
// rechace antes de pasar un minuto subiendo.

export const FORMATOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ACCEPT_IMAGEN = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";
export const MAX_MB_IMAGEN = 10;
export const TEXTO_FORMATOS_IMAGEN = `JPG, PNG, WebP o GIF · hasta ${MAX_MB_IMAGEN} MB`;

/** Mensaje para el dueño si el archivo no sirve; `null` si se puede subir. */
export function validarImagen(archivo: File): string | null {
  if (!(FORMATOS_IMAGEN as readonly string[]).includes(archivo.type)) {
    return `"${archivo.name}" no es JPG, PNG, WebP o GIF.`;
  }
  if (archivo.size > MAX_MB_IMAGEN * 1024 * 1024) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(1);
    return `"${archivo.name}" pesa ${mb} MB; el límite es ${MAX_MB_IMAGEN} MB.`;
  }
  return null;
}

/**
 * Avance de una subida, de 0 a 100, o `null` si no se conoce el total (algunos
 * navegadores y proxies no lo informan). Con `null` la barra se muestra
 * indeterminada en vez de quedarse en un 0 % engañoso.
 */
export type PorcentajeSubida = number | null;

/** Recibe el avance de una subida. */
export type OnProgreso = (porcentaje: PorcentajeSubida) => void;

/** Config de axios para un multipart que informa su avance. */
export function configSubida(onProgreso?: OnProgreso): AxiosRequestConfig {
  return {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgreso
      ? (e: AxiosProgressEvent) => {
          onProgreso(e.total ? Math.min(100, Math.round((e.loaded / e.total) * 100)) : null);
        }
      : undefined,
  };
}
