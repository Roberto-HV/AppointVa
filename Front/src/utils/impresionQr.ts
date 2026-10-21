import { escapeHtml } from "./html";

export interface DatosHojaQr {
  negocio: string | null | undefined;
  /** URL pública de reservas que codifica el QR. */
  url: string;
  /** PNG del QR como data URL (`canvas.toDataURL`). */
  qrDataUrl: string;
}

/**
 * Hoja carta/A4 con el QR de reservas, el nombre del negocio y la URL, para
 * pegar en el mostrador. Antes "Imprimir" llamaba a `window.print()` y salía el
 * dashboard entero.
 *
 * Se escribe en una ventana del mismo origen: todo valor pasa por `escapeHtml`.
 * La imagen solo se acepta si es un PNG en data URL (la genera el propio canvas).
 */
export function htmlHojaQr(d: DatosHojaQr): string {
  const src = d.qrDataUrl.startsWith("data:image/png;base64,") ? d.qrDataUrl : "";
  return `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${escapeHtml(`QR de reservas — ${d.negocio || "Mi negocio"}`)}</title>
      <style>
        @page { margin: 20mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Inter, Arial, sans-serif; color: #111827; text-align: center; padding-top: 10mm; }
        h1 { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
        p { font-size: 16px; color: #374151; }
        img { width: 90mm; height: 90mm; margin: 12mm auto; display: block; image-rendering: pixelated; }
        .url { font-family: 'Courier New', monospace; font-size: 14px; color: #111827; word-break: break-all; }
      </style>
    </head><body>
      <h1>${escapeHtml(d.negocio || "Mi negocio")}</h1>
      <p>Escanea para reservar tu cita</p>
      ${src ? `<img src="${escapeHtml(src)}" alt="Código QR de reservas"/>` : ""}
      <p class="url">${escapeHtml(d.url)}</p>
    </body></html>`;
}
