const COLOR_PRIMARIO = "#C8A961";
const COLOR_PRIMARIO_OSCURO = "#a88b45";
const COLOR_TEXTO_CLARO = "#6b7280";

const esc = (s: string) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export interface OpcionesExcel {
  subtitulo?: string;
  totales?: (string | number)[];
}

export function exportarExcel(
  encabezados: string[],
  filas: (string | number)[][][],
  nombreArchivo: string,
  titulo?: string,
  opciones?: OpcionesExcel,
) {
  const filasProcesadas = filas.flat();

  const th = `background:${COLOR_PRIMARIO};color:#ffffff;font-weight:bold;font-family:Arial,sans-serif;font-size:12px;padding:10px 14px;border:1px solid ${COLOR_PRIMARIO_OSCURO};white-space:nowrap;text-align:left;`;
  const tdBase = `font-family:Arial,sans-serif;font-size:11px;padding:7px 14px;border:1px solid #e5e7eb;vertical-align:middle;color:#1f2937;`;
  const tdTotales = `font-family:Arial,sans-serif;font-size:11px;padding:8px 14px;border:1px solid ${COLOR_PRIMARIO_OSCURO};vertical-align:middle;background:#f3f0e8;color:#7a6530;font-weight:bold;`;

  const encabezadosHtml = encabezados.map((h) => `<th style="${th}">${esc(h)}</th>`).join("");

  const filasHtml = filasProcesadas
    .map((fila, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
      const celdas = fila
        .map((v) => `<td style="${tdBase}background:${bg};">${esc(String(v))}</td>`)
        .join("");
      return `<tr>${celdas}</tr>`;
    })
    .join("");

  const totalesHtml = opciones?.totales
    ? `<tr>${opciones.totales.map((v) => `<td style="${tdTotales}">${esc(String(v))}</td>`).join("")}</tr>`
    : "";

  const headerRows = titulo ? (opciones?.subtitulo ? 4 : 3) : 1;

  const tituloHtml = titulo
    ? `<h2 style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;margin:0 0 2px 0;font-weight:bold;">${esc(titulo)}</h2>
       ${opciones?.subtitulo ? `<p style="font-family:Arial,sans-serif;font-size:11px;color:#374151;margin:0 0 2px 0;font-weight:500;">${esc(opciones.subtitulo)}</p>` : ""}
       <p style="font-family:Arial,sans-serif;font-size:10px;color:${COLOR_TEXTO_CLARO};margin:0 0 14px 0;">AppointVa · Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>Reporte</x:Name>
  <x:WorksheetOptions>
    <x:FreezePanes/>
    <x:FrozenNoSplit/>
    <x:SplitHorizontal>${headerRows}</x:SplitHorizontal>
    <x:TopRowBottomPane>${headerRows}</x:TopRowBottomPane>
    <x:ActivePane>2</x:ActivePane>
  </x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  body { margin: 16px; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
${tituloHtml}
<table>
  <thead><tr>${encabezadosHtml}</tr></thead>
  <tbody>${filasHtml}${totalesHtml}</tbody>
</table>
</body>
</html>`;

  const blob = new Blob(["﻿" + html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
