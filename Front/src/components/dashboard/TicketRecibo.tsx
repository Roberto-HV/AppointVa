import { Printer, Mail } from "lucide-react";
import type { CitaDto } from "../../types";
import { toUtcDate } from "../../utils/formatters";

interface Props {
  cita: CitaDto;
  negocioNombre: string;
  negocioLogo?: string;
  onClose: () => void;
  onEnviarEmail: () => void;
  enviandoEmail: boolean;
}

export default function TicketRecibo({ cita, negocioNombre, negocioLogo, onClose, onEnviarEmail, enviandoEmail }: Props) {
  const fecha = cita.inicioEn
    ? toUtcDate(cita.inicioEn).toLocaleString("es-MX", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const mostrarCambio = cita.metodoPago === "Efectivo" && cita.cambio != null && cita.cambio > 0;

  const handlePrint = () => {
    const monto = (cita.montoCobrado ?? cita.precio).toFixed(2);
    const filaEmpleado = cita.nombreEmpleado
      ? `<tr><td style="color:#6b7280;padding:3px 8px 3px 0">Atendió</td><td style="text-align:right;font-weight:500">${cita.nombreEmpleado}</td></tr>`
      : "";
    const filaRecibido = cita.montoRecibido != null
      ? `<tr><td style="color:#6b7280;padding:3px 8px 3px 0">Recibido</td><td style="text-align:right">$${cita.montoRecibido.toFixed(2)}</td></tr>`
      : "";
    const filaCambio = mostrarCambio
      ? `<tr><td style="color:#6b7280;padding:3px 8px 3px 0">Cambio</td><td style="text-align:right;font-weight:700">$${cita.cambio!.toFixed(2)}</td></tr>`
      : "";
    const filaPropina = cita.propina && cita.propina > 0
      ? `<tr><td style="color:#6b7280;padding:3px 8px 3px 0">Propina</td><td style="text-align:right">${cita.propina.toFixed(2)}</td></tr>`
      : "";

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; color: #111827; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 0; vertical-align: top; }
      </style>
    </head><body>
      <div style="text-align:center;padding-bottom:8px;border-bottom:1px dashed #d1d5db;margin-bottom:10px">
        ${negocioLogo ? `<img src="${negocioLogo}" alt="${negocioNombre}" style="height:40px;width:auto;object-fit:contain;margin:0 auto 6px;display:block"/>` : ""}
        <div style="font-weight:700;font-size:14px">${negocioNombre}</div>
        <div style="color:#6b7280;font-size:10px;margin-top:2px">Comprobante de pago</div>
      </div>
      <table style="margin-bottom:10px">
        <tr><td style="color:#6b7280;padding:3px 8px 3px 0">Cliente</td><td style="text-align:right;font-weight:500">${cita.nombreCliente}</td></tr>
        <tr><td style="color:#6b7280;padding:3px 8px 3px 0">Servicio</td><td style="text-align:right">${cita.nombreServicio}</td></tr>
        ${filaEmpleado}
        <tr><td style="color:#6b7280;padding:3px 8px 3px 0">Fecha</td><td style="text-align:right">${fecha}</td></tr>
      </table>
      <div style="border-top:1px dashed #d1d5db;padding-top:10px;margin-bottom:10px">
        <table>
          <tr><td style="color:#6b7280;padding:3px 8px 3px 0">Método</td><td style="text-align:right">${cita.metodoPago ?? ""}</td></tr>
          <tr><td style="color:#6b7280;padding:3px 8px 3px 0">Total</td><td style="text-align:right;font-weight:700">$${monto}</td></tr>
          ${filaRecibido}
          ${filaCambio}
          ${filaPropina}
        </table>
      </div>
      <div style="text-align:center;font-size:10px;color:#9ca3af;border-top:1px dashed #d1d5db;padding-top:8px">
        <div>Gracias por su visita</div>
        <div style="margin-top:2px">AppointVa</div>
      </div>
    </body></html>`;

    const ventana = window.open("", "_blank", "width=320,height=500");
    if (!ventana) return;
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); ventana.close(); }, 300);
  };

  return (
    <>
<div id="ticket-recibo-wrapper">
        <div
          id="ticket-recibo"
          className="bg-white text-gray-900 font-mono text-xs leading-relaxed p-4"
          style={{ width: "100%", maxWidth: "302px", margin: "0 auto" }}
        >
          {/* Header */}
          <div className="text-center mb-3 border-b border-dashed border-gray-300 pb-3">
            {negocioLogo && (
              <img
                src={negocioLogo}
                alt={negocioNombre}
                className="h-10 w-auto object-contain mx-auto mb-2"
              />
            )}
            <p className="font-bold text-sm">{negocioNombre}</p>
            <p className="text-gray-500 text-[10px]">Comprobante de pago</p>
          </div>

          {/* Appointment details */}
          <table className="w-full mb-3">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-2">Cliente</td>
                <td className="text-right font-medium">{cita.nombreCliente}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-2">Servicio</td>
                <td className="text-right">{cita.nombreServicio}</td>
              </tr>
              {cita.nombreEmpleado && (
                <tr>
                  <td className="text-gray-500 pr-2">Atendió</td>
                  <td className="text-right">{cita.nombreEmpleado}</td>
                </tr>
              )}
              <tr>
                <td className="text-gray-500 pr-2">Fecha</td>
                <td className="text-right">{fecha}</td>
              </tr>
            </tbody>
          </table>

          {/* Amounts */}
          <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="text-gray-500 pr-2">Método</td>
                  <td className="text-right">{cita.metodoPago}</td>
                </tr>
                <tr>
                  <td className="text-gray-500 pr-2">Total</td>
                  <td className="text-right font-bold">
                    ${(cita.montoCobrado ?? cita.precio).toFixed(2)}
                  </td>
                </tr>
                {cita.montoRecibido != null && (
                  <tr>
                    <td className="text-gray-500 pr-2">Recibido</td>
                    <td className="text-right">${cita.montoRecibido.toFixed(2)}</td>
                  </tr>
                )}
                {mostrarCambio && (
                  <tr>
                    <td className="text-gray-500 pr-2">Cambio</td>
                    <td className="text-right font-bold">${cita.cambio!.toFixed(2)}</td>
                  </tr>
                )}
                {cita.propina && cita.propina > 0 && (
                  <tr>
                    <td className="text-gray-500 pr-2">Propina</td>
                    <td className="text-right">${cita.propina.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400 border-t border-dashed border-gray-300 pt-3">
            <p>Gracias por su visita</p>
            <p>AppointVa</p>
          </div>
        </div>
      </div>

      {/* Action buttons — hidden on print */}
      <div className="print:hidden flex gap-2 mt-4 justify-end">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <Printer size={15} /> Imprimir ticket
        </button>
        <button
          onClick={onEnviarEmail}
          disabled={enviandoEmail}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition"
        >
          <Mail size={15} /> {enviandoEmail ? "Enviando…" : "Enviar por email"}
        </button>
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Cerrar
        </button>
      </div>
    </>
  );
}
