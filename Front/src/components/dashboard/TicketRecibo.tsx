import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Mail, X } from "lucide-react";
import type { CitaDto } from "../../types";
import {
  htmlTicket, leerPapelGuardado, guardarPapel, urlReservas, MEDIDAS_PAPEL,
  type NegocioTicket, type PapelTicket,
} from "../../utils/ticketRecibo";

interface Props {
  cita: CitaDto;
  negocio: NegocioTicket;
  onClose: () => void;
  onEnviarEmail: () => void;
  enviandoEmail: boolean;
  /**
   * Por qué falló el envío, para mostrarlo aquí dentro y no como aviso flotante.
   * El aviso se dibuja fuera del modal y Radix lo toma por un clic afuera, así
   * que cerraba el ticket y dejaba al negocio sin recibo y sin otra salida.
   * Mostrarlo aquí deja el ticket abierto para imprimirlo o compartirlo de otro modo.
   */
  errorEnvio: string | null;
  onDescartarError: () => void;
  /** El fallo al abrir la ventana de impresión comparte el aviso del correo. */
  onErrorImpresion: (mensaje: string) => void;
}

/**
 * El QR como texto `<svg>` para escribirlo en el documento del ticket. Se
 * renderiza en un nodo suelto (no en el árbol del modal) y se descarta.
 */
function qrComoSvg(url: string): string {
  const nodo = document.createElement("div");
  const raiz = createRoot(nodo);
  flushSync(() => {
    raiz.render(<QRCodeSVG value={url} size={160} level="M" marginSize={0} />);
  });
  const svg = nodo.innerHTML;
  raiz.unmount();
  return svg;
}

/** Espera a que carguen las imágenes (logo) antes de imprimir; nunca más de 2 s. */
function imprimirCuandoCargue(ventana: Window) {
  const imagenes = Array.from(ventana.document.images ?? []);
  const pendientes = imagenes.filter((img) => !img.complete);
  let impreso = false;
  const imprimir = () => {
    if (impreso) return;
    impreso = true;
    ventana.focus();
    ventana.print();
    ventana.close();
  };
  if (pendientes.length === 0) {
    setTimeout(imprimir, 300);
    return;
  }
  let restantes = pendientes.length;
  const listo = () => { restantes -= 1; if (restantes <= 0) imprimir(); };
  pendientes.forEach((img) => {
    img.addEventListener("load", listo, { once: true });
    img.addEventListener("error", listo, { once: true });
  });
  setTimeout(imprimir, 2000);
}

const OPCIONES_PAPEL: { valor: PapelTicket; etiqueta: string }[] = [
  { valor: "80", etiqueta: "80 mm" },
  { valor: "58", etiqueta: "58 mm" },
];

export default function TicketRecibo({
  cita, negocio, onClose, onEnviarEmail, enviandoEmail, errorEnvio, onDescartarError,
  onErrorImpresion,
}: Props) {
  const [papel, setPapel] = useState<PapelTicket>(leerPapelGuardado);
  const [qr, setQr] = useState<{ url: string; svg: string } | null>(null);
  const [altoVista, setAltoVista] = useState(480);
  const vistaRef = useRef<HTMLIFrameElement>(null);

  const origen = window.location.origin;
  const reservas = urlReservas(negocio.slug, origen);

  // El QR se genera en una tarea aparte: flushSync no puede correr mientras
  // React está en render ni en commit (y los efectos pasivos cuentan como commit).
  useEffect(() => {
    if (!reservas) return;
    const tarea = setTimeout(() => setQr({ url: reservas, svg: qrComoSvg(reservas) }), 0);
    return () => clearTimeout(tarea);
  }, [reservas]);
  const qrSvg = qr && qr.url === reservas ? qr.svg : undefined;

  // Un solo documento para la vista previa y para la impresión.
  const html = useMemo(
    () => htmlTicket({ cita, negocio, papel, origen, qrSvg }),
    [cita, negocio, papel, origen, qrSvg],
  );

  const cambiarPapel = (valor: PapelTicket) => {
    setPapel(valor);
    guardarPapel(valor);
  };

  const ajustarAlto = () => {
    const doc = vistaRef.current?.contentDocument;
    const alto = doc?.documentElement?.scrollHeight;
    if (alto) setAltoVista(alto);
  };

  const handlePrint = () => {
    onDescartarError();
    const ventana = window.open("", "_blank", "width=360,height=640");
    if (!ventana) {
      // Aquí dentro y no como aviso flotante, por lo mismo que el fallo del correo:
      // el toast se dibuja fuera del modal y Radix lo toma por un clic afuera, así
      // que cerraba el ticket justo cuando no se pudo imprimir. En iPhone el bloqueo
      // de ventanas emergentes es común, así que es un camino que se recorre.
      onErrorImpresion("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.");
      return;
    }
    ventana.document.write(html);
    ventana.document.close();
    imprimirCuandoCargue(ventana);
  };

  return (
    <>
      {/* Vista previa: el mismo HTML que se imprime, al ancho del papel. */}
      <div className="bg-slate-100 dark:bg-slate-900/60 rounded-xl p-3 flex justify-center overflow-x-auto">
        <iframe
          ref={vistaRef}
          title="Vista previa del comprobante"
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={ajustarAlto}
          className="bg-white shadow-sm border border-slate-200 dark:border-slate-700 shrink-0"
          style={{ width: MEDIDAS_PAPEL[papel].anchoPx, height: altoVista }}
        />
      </div>

      {errorEnvio && (
        <div
          role="alert"
          className="print:hidden mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          <span className="flex-1">{errorEnvio}</span>
          <button
            type="button"
            onClick={onDescartarError}
            aria-label="Descartar el aviso"
            className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/50"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Action buttons — hidden on print.
          En pantalla angosta van apilados y a todo lo ancho: en una sola fila con
          flex-wrap, el selector de papel empujado por mr-auto dejaba los tres
          botones envueltos y desalineados dentro del modal. */}
      <div className="print:hidden mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <div
          role="radiogroup"
          aria-label="Papel"
          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 sm:mr-auto"
        >
          <span aria-hidden="true">Papel:</span>
          {OPCIONES_PAPEL.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={papel === o.valor}
              onClick={() => cambiarPapel(o.valor)}
              className={`px-2 py-1 rounded-md border transition ${
                papel === o.valor
                  ? "bg-slate-700 text-white border-slate-700"
                  : "border-slate-200 dark:border-slate-600 hover:border-slate-400"
              }`}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition sm:w-auto"
        >
          <Printer size={15} /> Imprimir ticket
        </button>
        <button
          type="button"
          onClick={onEnviarEmail}
          disabled={enviandoEmail}
          className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm bg-slate-700 text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition sm:w-auto"
        >
          <Mail size={15} /> {enviandoEmail ? "Enviando…" : "Enviar por email"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition sm:w-auto"
        >
          Cerrar
        </button>
      </div>
    </>
  );
}
