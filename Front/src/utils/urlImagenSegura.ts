/** Solo URLs http(s) pueden ir en el `src` de una imagen que llega del servidor. */
export function urlImagenSegura(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}
