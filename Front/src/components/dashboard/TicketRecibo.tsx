import { Printer, Mail } from "lucide-react";
import type { CitaDto } from "../../types";

interface Props {
  cita: CitaDto;
  negocioNombre: string;
  onClose: () => void;
  onEnviarEmail: () => void;
  enviandoEmail: boolean;
}

export default function TicketRecibo({ cita, negocioNombre, onClose, onEnviarEmail, enviandoEmail }: Props) {
  const fecha = cita.inicioEn
    ? new Date(cita.inicioEn).toLocaleString("es-MX", {
        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

  const mostrarCambio = cita.metodoPago === "Efectivo" && cita.cambio != null && cita.cambio > 0;

  const handlePrint = () => window.print();

  return (
    <>
      {/* Print styles — 80mm thermal receipt */}
      <style>{`
        @media print {
          body > *:not(#ticket-recibo-wrapper) { display: none !important; }
          #ticket-recibo-wrapper { display: block !important; }
          @page { size: 80mm auto; margin: 4mm; }
        }
      `}</style>

      <div id="ticket-recibo-wrapper">
        <div
          id="ticket-recibo"
          className="bg-white text-gray-900 font-mono text-xs leading-relaxed p-4"
          style={{ width: "100%", maxWidth: "302px", margin: "0 auto" }}
        >
          {/* Header */}
          <div className="text-center mb-3 border-b border-dashed border-gray-300 pb-3">
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
