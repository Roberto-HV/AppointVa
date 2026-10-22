import ExcelJS from "exceljs";
import { fechaLocal } from "./fechas";

// Paleta neutra (slate). El dorado de marca es solo para el logo: no va en los
// archivos exportados.
const SLATE = "1E293B";
const SLATE_MID = "334155";
const SLATE_SOFT = "F1F5F9";
const SLATE_ACCENT = "94A3B8";
const BORDER_GRAY = "D1D5DB";
const TEXT_DARK = "111827";
const TEXT_MID = "6B7280";

const FORMATO_MONEDA = '"$"#,##0.00';
const FORMATO_ENTERO = "#,##0";
const FORMATO_DECIMAL = "#,##0.00";
const FORMATO_PORCENTAJE = "0.0%";
const FORMATO_FECHA = "dd/mm/yyyy";
const FORMATO_FECHA_HORA = "dd/mm/yyyy hh:mm";

/**
 * Valor de una celda. Los números y las fechas se escriben como celdas reales
 * (se pueden sumar, ordenar y filtrar en Excel), no como texto.
 *  - `number`: número (entero o con dos decimales).
 *  - `{ moneda }`: número con formato `$#,##0.00`.
 *  - `{ porcentaje }`: 0–100; se guarda como fracción con formato `0.0%`.
 *  - `Date`: fecha local; con hora si no es medianoche.
 */
export type CeldaExcel =
  | string
  | number
  | Date
  | null
  | undefined
  | { moneda: number }
  | { porcentaje: number };

export interface OpcionesExcel {
  subtitulo?: string;
  totales?: CeldaExcel[];
}

export interface CeldaPreparada {
  value: string | number | Date;
  numFmt?: string;
  /** Lo que se ve, para calcular el ancho de la columna. */
  texto: string;
}

/**
 * ExcelJS guarda las fechas en UTC: una cita a las 10:00 en México se vería a
 * las 16:00. Se pasa la hora local como si fuera UTC para que se lea igual.
 */
function fechaComoUtc(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

/**
 * S9: ExcelJS ya escribe el texto como celda de texto (Excel no lo evalúa al abrir),
 * pero si alguien edita la celda y pulsa Enter, "=…" pasa a ser fórmula, y el mismo
 * texto copiado a un CSV sí se ejecuta. Se antepone un apóstrofo a lo que empieza
 * con = + - @ (o tabulador / retorno), salvo números y teléfonos ("+52 55 1234 5678",
 * "-15"): sin letras ni símbolos no hay fórmula que armar. Igual que `Escapar` del CSV
 * del servidor.
 */
const INICIO_FORMULA = /^[=+\-@\t\r]/;
const NUMERO_O_TELEFONO = /^[+-]?[0-9 ().-]+$/;

export function neutralizarFormula(texto: string): string {
  return INICIO_FORMULA.test(texto) && !NUMERO_O_TELEFONO.test(texto) ? `'${texto}` : texto;
}

export function prepararCelda(v: CeldaExcel): CeldaPreparada {
  if (v === null || v === undefined) return { value: "", texto: "" };
  if (typeof v === "number") {
    const entero = Number.isInteger(v);
    return { value: v, numFmt: entero ? FORMATO_ENTERO : FORMATO_DECIMAL, texto: v.toLocaleString("es-MX") };
  }
  if (typeof v === "string") {
    const seguro = neutralizarFormula(v);
    return { value: seguro, texto: seguro };
  }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return { value: "", texto: "" };
    const conHora = v.getHours() !== 0 || v.getMinutes() !== 0;
    return {
      value: fechaComoUtc(v),
      numFmt: conHora ? FORMATO_FECHA_HORA : FORMATO_FECHA,
      texto: conHora ? "00/00/0000 00:00" : "00/00/0000",
    };
  }
  if ("moneda" in v) {
    return { value: v.moneda, numFmt: FORMATO_MONEDA, texto: `$${v.moneda.toFixed(2)}` };
  }
  return { value: v.porcentaje / 100, numFmt: FORMATO_PORCENTAJE, texto: `${v.porcentaje.toFixed(1)}%` };
}

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(64 + ((n - 1) % 26 + 1)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Genera y descarga el archivo. Devuelve la promesa para que quien la llame
 * pueda avisar si falla (antes el error solo iba a la consola y no pasaba nada).
 */
export function exportarExcel(
  encabezados: string[],
  filas: CeldaExcel[][][],
  nombreArchivo: string,
  titulo?: string,
  opciones?: OpcionesExcel,
): Promise<void> {
  return _generar(encabezados, filas, nombreArchivo, titulo, opciones);
}

async function _generar(
  encabezados: string[],
  filas: CeldaExcel[][][],
  nombreArchivo: string,
  titulo?: string,
  opciones?: OpcionesExcel,
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AppointVa";
  const sheet = workbook.addWorksheet("Reporte");

  const filasProcesadas = filas.flat().map((fila) => fila.map(prepararCelda));
  const totalesProcesados = opciones?.totales?.map(prepararCelda);
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
    bannerCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" }, name: "Arial" };
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
    metaCell.font = { size: 9, color: { argb: "FFCBD5E1" }, name: "Arial" };
    metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 2 };
    sheet.mergeCells(`A${r}:${lastCol}${r}`);

    // ── Separador visual ────────────────────────────────────────────
    r++;
    const sepRow = sheet.getRow(r);
    sepRow.height = 8;
    fillRow(r, `FF${SLATE_SOFT}`);
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
      bottom: { style: "medium", color: { argb: `FF${SLATE}` } },
      right: { style: "thin", color: { argb: "FF4B5563" } },
    };
  });

  sheet.views = [{ state: "frozen", ySplit: r }];

  // ── Filas de datos ────────────────────────────────────────────────
  const dataStart = r + 1;
  filasProcesadas.forEach((fila, i) => {
    r++;
    const row = sheet.getRow(r);
    row.height = 20;
    const bg = i % 2 === 1 ? `FF${SLATE_SOFT}` : "FFFFFFFF";
    fila.forEach((celda, j) => {
      const cell = row.getCell(j + 1);
      cell.value = celda.value;
      if (celda.numFmt) cell.numFmt = celda.numFmt;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 10, color: { argb: `FF${TEXT_DARK}` }, name: "Arial" };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = {
        bottom: { style: "hair", color: { argb: `FF${BORDER_GRAY}` } },
        right: { style: "hair", color: { argb: `FF${BORDER_GRAY}` } },
      };
    });
    row.getCell(1).border = {
      ...row.getCell(1).border,
      left: { style: "thin", color: { argb: `FF${BORDER_GRAY}` } },
    };
    // Borde derecho externo
    row.getCell(cols).border = {
      ...row.getCell(cols).border,
      right: { style: "thin", color: { argb: `FF${BORDER_GRAY}` } },
    };
  });

  // ── Fila de totales ───────────────────────────────────────────────
  const dataEnd = r;
  if (totalesProcesados) {
    r++;
    const totRow = sheet.getRow(r);
    totRow.height = 24;
    totalesProcesados.forEach((celda, i) => {
      const cell = totRow.getCell(i + 1);
      cell.value = celda.value;
      if (celda.numFmt) cell.numFmt = celda.numFmt;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${SLATE_SOFT}` } };
      cell.font = { bold: true, size: 10, color: { argb: `FF${SLATE}` }, name: "Arial" };
      cell.alignment = { vertical: "middle", indent: 1 };
      cell.border = {
        top: { style: "medium", color: { argb: `FF${SLATE_ACCENT}` } },
        bottom: { style: "medium", color: { argb: `FF${SLATE_MID}` } },
        right: { style: "hair", color: { argb: `FF${BORDER_GRAY}` } },
      };
    });
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
      const len = fila[ci]?.texto.length ?? 0;
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
  // Fecha local: con `toISOString()` un archivo bajado a las 19:00 en México
  // llevaba la fecha de mañana.
  a.download = `${nombreArchivo}-${fechaLocal(new Date())}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
