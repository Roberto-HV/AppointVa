// B8 (decisión 9): códigos de recuperación de la verificación en dos pasos.
// El servidor los entrega en claro una sola vez; aquí solo se arma el texto y el
// archivo .txt, todo en el navegador (nada sale a la red).

/** Con esta cantidad o menos se avisa que conviene generar códigos nuevos. */
export const UMBRAL_POCOS_CODIGOS = 3;

export const NOMBRE_ARCHIVO_CODIGOS = "appointva-codigos-recuperacion.txt";

export function quedanPocosCodigos(restantes: number): boolean {
  return restantes <= UMBRAL_POCOS_CODIGOS;
}

export function textoCodigosRecuperacion(codigos: string[], cuenta?: string, fecha = new Date()): string {
  const generado = fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  return [
    "AppointVa — códigos de recuperación",
    ...(cuenta ? [`Cuenta: ${cuenta}`] : []),
    `Generados el ${generado}`,
    "",
    "Cada código sirve una sola vez para entrar si no tienes tu app autenticadora.",
    "Guárdalos en un lugar seguro. Al generar códigos nuevos, estos dejan de servir.",
    "",
    ...codigos,
    "",
  ].join("\n");
}

/** Descarga el .txt con un Blob local: los códigos no pasan por ningún servidor. */
export function descargarCodigosRecuperacion(codigos: string[], cuenta?: string): void {
  const blob = new Blob([textoCodigosRecuperacion(codigos, cuenta)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = NOMBRE_ARCHIVO_CODIGOS;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
