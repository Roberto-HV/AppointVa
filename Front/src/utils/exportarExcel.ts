import ExcelJS from "exceljs";

const GOLD = "C8A961";
const GOLD_DARK = "a88b45";
const GOLD_LIGHT = "FFF8E8";
const SLATE = "1E293B";
const SLATE_MID = "334155";
const BORDER_GRAY = "D1D5DB";
const TEXT_DARK = "111827";
const TEXT_MID = "6B7280";

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

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
  _generar(encabezados, filas, nombreArchivo, titulo, opciones).catch(console.error);
}

async function _generar(
  encabezados: string[],
  filas: (string | number)[][][],
  nombreArchivo: string,
  titulo?: string,
  opciones?: OpcionesExcel,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AppointVa";
  const sheet = workbook.addWorksheet("Reporte");

  const filasProcesadas = filas.flat();
  const cols = encabezados.length;
  const lastCol = colLetter(cols);
  let r = 0;

  function fillRow(rowNum: number, argb: string) {
    const row = sheet.getRow(rowNum);
    for (let c = 1; c <= cols; c++) {
      row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  }

  if (titulo) {
    // ── Banner principal ────────────────────────────────────────────
    r++;
    const bannerRow = sheet.getRow(r);
    bannerRow.height = 36;
    fillRow(r, `FF${SLATE}`);
    const bannerCell = bannerRow.getCell(1);
    bannerCell.value = titulo.toUpperCase();
    bannerCell.font = { bold: true, size: 16, color: { argb: `FF${GOLD}` }, name: "Arial" };
    bannerCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
    sheet.mergeCells(`A${r}:${lastCol}${r}`);

    // ── Barra de meta (fecha + subtitulo) ───────────────────────────
    r++;
    const metaRow = sheet.getRow(r);
    metaRow.height = 18;
    fillRow(r, `FF${SLATE_MID}`);
    const fecha = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const parts = ["AppointVa", `Generado el ${fecha}`];
    if (opciones?.subtitulo) parts.splice(1, 0, opciones.subtitulo);
    const metaCell = metaRow.getCell(1);
    metaCell.value = parts.join("  ·  ");
    metaCell.font = { size: 9, color: { argb: "FFB0BAC8" }, name: "Arial" };
    metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
    sheet.mergeCells(`A${r}:${lastCol}${r}`);

    // ── Separador visual ────────────────────────────────────────────
    r++;
    const sepRow = sheet.getRow(r);
    sepRow.height = 8;
    fillRow(r, `FF${GOLD}22`); // sutilísimo gold tint
    sheet.mergeCells(`A${r}:${lastCol}${r}`);
  }

  // ── Encabezados de columna ────────────────────────────────────────
  r++;
  const headerRow = sheet.getRow(r);
  headerRow.height = 26;
  encabezados.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${SLATE_MID}` } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Arial" };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = {
      bottom: { style: "medium", color: { argb: `FF${GOLD_DARK}` } },
      right: { style: "thin", color: { argb: "FF4B5563" } },
    };
  });
  // Línea dorada sobre los headers
  headerRow.getCell(1).border = {
    ...headerRow.getCell(1).border,
    left: { style: "medium", color: { argb: `FF${GOLD}` } },
  };

  sheet.views = [{ state: "frozen", ySplit: r }];

  // ── Filas de datos ────────────────────────────────────────────────
  const dataStart = r + 1;
  filasProcesadas.forEach((fila, i) => {
    r++;
    const row = sheet.getRow(r);
    row.height = 20;
    const isOdd = i % 2 === 1;
    const bg = isOdd ? `FF${GOLD_LIGHT}` : "FFFFFFFF";
    fila.forEach((v, j) => {
      const cell = row.getCell(j + 1);
      cell.value = String(v);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 10, color: { argb: `FF${TEXT_DARK}` }, name: "Arial" };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = {
        bottom: { style: "hair", color: { argb: `FF${BORDER_GRAY}` } },
        right: { style: "hair", color: { argb: `FF${BORDER_GRAY}` } },
      };
    });
    // Acento izquierdo dorado en filas impares
    if (isOdd) {
      row.getCell(1).border = {
        ...row.getCell(1).border,
        left: { style: "medium", color: { argb: `FF${GOLD}` } },
      };
    } else {
      row.getCell(1).border = {
        ...row.getCell(1).border,
        left: { style: "thin", color: { argb: `FF${BORDER_GRAY}` } },
      };
    }
    // Borde derecho externo
    row.getCell(cols).border = {
      ...row.getCell(cols).border,
      right: { style: "thin", color: { argb: `FF${BORDER_GRAY}` } },
    };
  });

  // ── Fila de totales ───────────────────────────────────────────────
  const dataEnd = r;
  if (opciones?.totales) {
    r++;
    const totRow = sheet.getRow(r);
    totRow.height = 24;
    opciones.totales.forEach((v, i) => {
      const cell = totRow.getCell(i + 1);
      cell.value = String(v);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${GOLD}18` } };
      cell.font = { bold: true, size: 10, color: { argb: `FF${GOLD_DARK}` }, name: "Arial" };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = {
        top: { style: "medium", color: { argb: `FF${GOLD}` } },
        bottom: { style: "medium", color: { argb: `FF${GOLD_DARK}` } },
        right: { style: "hair", color: { argb: `FF${BORDER_GRAY}` } },
      };
    });
    totRow.getCell(1).border = {
      ...totRow.getCell(1).border,
      left: { style: "medium", color: { argb: `FF${GOLD}` } },
    };
  }

  // ── Borde inferior del área de datos ─────────────────────────────
  if (dataEnd >= dataStart) {
    const lastDataRow = sheet.getRow(dataEnd);
    for (let c = 1; c <= cols; c++) {
      const cell = lastDataRow.getCell(c);
      cell.border = {
        ...cell.border,
        bottom: { style: "thin", color: { argb: `FF${BORDER_GRAY}` } },
      };
    }
  }

  // ── Ancho de columnas ─────────────────────────────────────────────
  encabezados.forEach((header, ci) => {
    let max = header.length;
    filasProcesadas.forEach((fila) => {
      const len = String(fila[ci] ?? "").length;
      if (len > max) max = len;
    });
    sheet.getColumn(ci + 1).width = Math.min(Math.max(max + 5, 12), 50);
  });

  // ── Pie de página ─────────────────────────────────────────────────
  sheet.headerFooter.oddFooter = `&L&9&K${TEXT_MID}AppointVa&R&9&K${TEXT_MID}Página &P de &N`;

  // ── Descarga ──────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
