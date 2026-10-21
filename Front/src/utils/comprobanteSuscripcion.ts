import type { PagoSuscripcionDto } from "../api/admin";
import { escapeHtml } from "./html";
import { toUtcDate } from "./formatters";

// Comprobante imprimible de un pago de suscripción (panel de SuperAdmin).
// Se escribe con document.write en una ventana del mismo origen y el nombre del
// negocio viene del registro público, así que TODO valor interpolado se escapa.

function formatFechaMx(iso: string) {
  return toUtcDate(iso).toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function generarHTMLComprobante(pago: PagoSuscripcionDto): string {
  const mesesLabel = pago.mesesPagados >= 600 ? "De por vida" : pago.mesesPagados === 1 ? "1 mes" : `${pago.mesesPagados} meses`;
  const folio = `PAGO-${String(pago.numeroPago).padStart(3, "0")}`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Comprobante ${escapeHtml(folio)}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;background:#fff;padding:48px;max-width:520px;margin:0 auto;}
  .logo{font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;}
  .logo span{color:#C8A961;}
  .subtitle{font-size:12px;color:#6b7280;margin-bottom:32px;}
  h2{font-size:15px;font-weight:700;color:#111;margin:0 0 20px;}
  .folio{display:inline-block;background:#f3f4f6;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;font-family:monospace;margin-bottom:24px;}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row .label{color:#6b7280;}
  .row .value{font-weight:600;color:#111;}
  .monto{font-size:22px;font-weight:800;color:#C8A961;text-align:center;margin:24px 0 8px;}
  .footer{margin-top:40px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px solid #f3f4f6;padding-top:16px;}
  @media print{body{padding:24px;}}
</style></head><body>
<div class="logo">Appoint<span>Va</span></div>
<div class="subtitle">Sistema de reservas · appointva.com</div>
<div class="folio">${escapeHtml(folio)}</div>
<h2>Comprobante de pago de suscripción</h2>
<div class="monto">$${escapeHtml(pago.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 }))} MXN</div>
<div class="row"><span class="label">Negocio</span><span class="value">${escapeHtml(pago.negocioNombre)}</span></div>
<div class="row"><span class="label">Período pagado</span><span class="value">${escapeHtml(formatFechaMx(pago.periodoDesde))} – ${escapeHtml(formatFechaMx(pago.periodoHasta))}</span></div>
<div class="row"><span class="label">Meses pagados</span><span class="value">${escapeHtml(mesesLabel)}</span></div>
<div class="row"><span class="label">Fecha de pago</span><span class="value">${escapeHtml(formatFechaMx(pago.fechaPago))}</span></div>
${pago.notas ? `<div class="row"><span class="label">Notas</span><span class="value">${escapeHtml(pago.notas)}</span></div>` : ""}
<div class="row"><span class="label">Registrado por</span><span class="value">${escapeHtml(pago.registradoPorEmail)}</span></div>
<div class="footer">AppointVa © ${escapeHtml(new Date().getFullYear())} · hola@appointva.com · Documento generado el ${escapeHtml(formatFechaMx(new Date().toISOString()))}</div>
</body></html>`;
}
