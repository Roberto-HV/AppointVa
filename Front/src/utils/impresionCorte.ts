import { escapeHtml } from "./html";

export interface FilaCorte {
  etiqueta: string;
  cantidad: number;
  monto: number;
}

export interface DatosImpresionCorte {
  negocio: string | null | undefined;
  fechaLegible: string;
  citasAtendidas: number;
  totalCobrado: number;
  totalPropinas: number;
  porMetodo: FilaCorte[];
  porEmpleado: FilaCorte[];
}

const dinero = (n: number) => `$${n.toFixed(2)}`;

function filas(items: FilaCorte[]): string {
  return items
    .map(
      (f) =>
        `<tr><td style="padding:3px 8px 3px 0">${escapeHtml(f.etiqueta)}</td>` +
        `<td style="text-align:right">${escapeHtml(`${f.cantidad} cita${f.cantidad !== 1 ? "s" : ""}`)}</td>` +
        `<td style="text-align:right;font-weight:600">${escapeHtml(dinero(f.monto))}</td></tr>`
    )
    .join("");
}

/**
 * Documento de 80 mm para imprimir el corte del día.
 *
 * Se escribe en una ventana del mismo origen, así que TODO valor interpolado
 * pasa por `escapeHtml`: el nombre del negocio y los de los empleados los
 * escriben los usuarios y no deben poder inyectar marcado.
 */
export function htmlCorteCaja(d: DatosImpresionCorte): string {
  return `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Corte de caja</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .section { border-top: 1px dashed #d1d5db; margin-top: 10px; padding-top: 10px; }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-weight:700;font-size:14px">${escapeHtml(d.negocio || "Negocio")}</div>
        <div style="color:#6b7280;font-size:10px;margin-top:2px">CORTE DE CAJA</div>
        <div style="font-size:10px;margin-top:2px">${escapeHtml(d.fechaLegible)}</div>
      </div>
      <div class="section">
        <table>
          <tr><td>Citas atendidas</td><td style="text-align:right;font-weight:700">${escapeHtml(d.citasAtendidas)}</td></tr>
          <tr><td>Total cobrado</td><td style="text-align:right;font-weight:700">${escapeHtml(dinero(d.totalCobrado))}</td></tr>
          ${d.totalPropinas > 0 ? `<tr><td>Propinas</td><td style="text-align:right">${escapeHtml(dinero(d.totalPropinas))}</td></tr>` : ""}
        </table>
      </div>
      ${d.porMetodo.length > 0 ? `
      <div class="section">
        <div style="font-weight:700;margin-bottom:6px;font-size:10px;letter-spacing:.05em">DESGLOSE POR MÉTODO</div>
        <table>${filas(d.porMetodo)}</table>
      </div>` : ""}
      ${d.porEmpleado.length > 0 ? `
      <div class="section">
        <div style="font-weight:700;margin-bottom:6px;font-size:10px;letter-spacing:.05em">POR EMPLEADO</div>
        <table>${filas(d.porEmpleado)}</table>
      </div>` : ""}
      <div style="text-align:center;font-size:10px;color:#9ca3af;border-top:1px dashed #d1d5db;margin-top:10px;padding-top:8px">AppointVa</div>
    </body></html>`;
}
