// ── Comprobante de pago (ticket térmico) ───────────────────────────────────────
//
// Arma el documento HTML del ticket que se imprime después de cobrar una cita.
// El mismo texto se escribe en la ventana de impresión y en el `srcdoc` de la
// vista previa del modal: así lo que ve el cajero es exactamente lo que sale.
//
// Todo dato que venga del servidor o del usuario pasa por `escapeHtml`: el
// documento se escribe en una ventana del mismo origen y el nombre del cliente
// llega desde la reserva pública.

import type { CitaDto, NegocioDto } from "../types";
import { escapeHtml } from "./html";
import { formatFechaMx, formatHora } from "./formatters";
import { getSectorTerms } from "../hooks/useSectorTerms";

export type PapelTicket = "80" | "58";

export const CLAVE_PAPEL_TICKET = "appointva-ticket-papel";

/** El papel elegido en este dispositivo; 80 mm cuando no hay nada guardado. */
export function leerPapelGuardado(): PapelTicket {
  try {
    return localStorage.getItem(CLAVE_PAPEL_TICKET) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

export function guardarPapel(papel: PapelTicket): void {
  try { localStorage.setItem(CLAVE_PAPEL_TICKET, papel); } catch { /* almacenamiento no disponible */ }
}

/**
 * Ancho del papel, margen lateral y cuerpo de letra (~42 columnas en 80 mm,
 * ~32 en 58 mm). `anchoPx` es el ancho de la vista previa: el papel a 96 dpi
 * más un par de píxeles para que no aparezca barra horizontal.
 */
export const MEDIDAS_PAPEL: Record<PapelTicket, { papelMm: number; margenMm: number; letraPx: number; anchoPx: number }> = {
  "80": { papelMm: 80, margenMm: 4, letraPx: 11, anchoPx: 305 },
  "58": { papelMm: 58, margenMm: 3, letraPx: 10, anchoPx: 222 },
};

export type NegocioTicket = Pick<NegocioDto, "nombre"> &
  Partial<Pick<NegocioDto, "slug" | "logoUrl" | "direccion" | "telefono" | "sector">>;

export interface RenglonTicket {
  etiqueta: string;
  monto: string;
}

/** Los números del ticket ya resueltos: qué renglones aparecen y con qué importe. */
export interface ResumenTicket {
  servicio: RenglonTicket;
  subtotal: string | null;
  descuento: RenglonTicket | null;
  cargoAdicional: string | null;
  anticipo: string | null;
  total: string;
  pagos: RenglonTicket[];
  recibido: string | null;
  cambio: string | null;
  propina: string | null;
}

const CENTAVO = 0.005;

/** "$1,280.00": siempre con centavos, como en cualquier ticket. */
export function dinero(n: number): string {
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Reparte el cobro en renglones que cierran en el papel:
 * Subtotal − Descuento − Anticipo pagado (+ Cargo adicional) = TOTAL.
 *
 * - El cupón de la reserva ya viene restado en `precio`; el precio de lista del
 *   servicio (`precioServicio`) permite mostrarlo como descuento.
 * - Si en caja se cobró menos de lo esperado, la diferencia también es descuento.
 * - La propina va en su propio renglón y nunca se suma al TOTAL: el cambio se
 *   calcula sin ella y «Recibido − TOTAL = Cambio» tiene que cerrar.
 */
export function resumirTicket(cita: CitaDto): ResumenTicket {
  const precio = cita.precio;
  const precioLista = cita.precioServicio != null && cita.precioServicio > precio + CENTAVO
    ? cita.precioServicio
    : precio;
  const anticipo = cita.anticipoRecibido && cita.montoAnticipo && cita.montoAnticipo > 0
    ? cita.montoAnticipo
    : 0;
  const cobrado = cita.montoCobrado ?? Math.max(0, precio - anticipo);

  const descuentoReserva = redondear(precioLista - precio);
  const diferenciaCaja = redondear(precio - anticipo - cobrado);
  const descuento = redondear(descuentoReserva + Math.max(0, diferenciaCaja));
  const cargoAdicional = redondear(Math.max(0, -diferenciaCaja));

  // "Descuento 10%" solo cuando el porcentaje es exacto; si no, solo el importe.
  const pct = precioLista > 0 ? (descuento / precioLista) * 100 : 0;
  const pctExacto = Math.abs(pct - Math.round(pct)) < 0.01 && Math.round(pct) > 0;
  const etiquetaDescuento = pctExacto ? `Descuento ${Math.round(pct)}%` : "Descuento";

  const hayAjustes = descuento > CENTAVO || anticipo > CENTAVO || cargoAdicional > CENTAVO;

  const duracion = cita.duracionMinutos > 0 ? ` · ${cita.duracionMinutos} min` : "";

  // Pago dividido: el primer método se lleva lo que no cubrió el segundo.
  const m2 = cita.metodoPago2 && cita.montoPago2 && cita.montoPago2 > 0 ? cita.montoPago2 : 0;
  const pagos: RenglonTicket[] = [];
  if (m2 > 0) {
    pagos.push({ etiqueta: cita.metodoPago || "Pago", monto: dinero(Math.max(0, cobrado - m2)) });
    pagos.push({ etiqueta: cita.metodoPago2!, monto: dinero(m2) });
  } else {
    pagos.push({ etiqueta: cita.metodoPago || "Pago", monto: dinero(cobrado) });
  }

  const hayEfectivo = cita.metodoPago === "Efectivo" || (m2 > 0 && cita.metodoPago2 === "Efectivo");

  return {
    servicio: { etiqueta: `${cita.nombreServicio}${duracion}`, monto: dinero(precioLista) },
    subtotal: hayAjustes ? dinero(precioLista) : null,
    descuento: descuento > CENTAVO ? { etiqueta: etiquetaDescuento, monto: `-${dinero(descuento)}` } : null,
    cargoAdicional: cargoAdicional > CENTAVO ? dinero(cargoAdicional) : null,
    anticipo: anticipo > CENTAVO ? `-${dinero(anticipo)}` : null,
    total: dinero(cobrado),
    pagos,
    recibido: hayEfectivo && cita.montoRecibido != null && cita.montoRecibido > 0 ? dinero(cita.montoRecibido) : null,
    cambio: hayEfectivo && cita.cambio != null && cita.cambio > CENTAVO ? dinero(cita.cambio) : null,
    propina: cita.propina != null && cita.propina > CENTAVO ? dinero(cita.propina) : null,
  };
}

/** El enlace público de reservas del negocio, o null si aún no hay slug. */
export function urlReservas(slug: string | null | undefined, origen: string): string | null {
  return slug ? `${origen}/b/${slug}` : null;
}

/** Solo URLs http(s) pueden ir en el `src` del logo. */
function urlImagenSegura(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export interface OpcionesTicket {
  cita: CitaDto;
  negocio: NegocioTicket;
  papel: PapelTicket;
  /** Origen de la app ("https://appointva.com"): enlace de reservas y logo de AppointVa. */
  origen: string;
  /**
   * El QR del enlace de reservas como `<svg>` ya generado por qrcode.react. Es
   * marcado propio (solo rectángulos y rutas), por eso no se escapa.
   */
  qrSvg?: string;
}

const fila = (etiqueta: string, valor: string, clase = "") =>
  `<div class="fila${clase ? ` ${clase}` : ""}"><span>${escapeHtml(etiqueta)}</span><span class="monto">${escapeHtml(valor)}</span></div>`;

/** El documento completo del ticket, listo para `document.write` o `srcdoc`. */
export function htmlTicket({ cita, negocio, papel, origen, qrSvg }: OpcionesTicket): string {
  const m = MEDIDAS_PAPEL[papel];
  const r = resumirTicket(cita);
  const terminos = getSectorTerms(negocio.sector);
  const esSalud = negocio.sector === "salud";
  const logo = urlImagenSegura(negocio.logoUrl);
  const reservas = urlReservas(negocio.slug, origen);
  const reservasVisible = reservas?.replace(/^https?:\/\//i, "");

  const encabezado = [
    logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="${escapeHtml(negocio.nombre)}"/>` : "",
    `<div class="negocio">${escapeHtml(negocio.nombre)}</div>`,
    negocio.direccion?.trim() ? `<div class="dato">${escapeHtml(negocio.direccion.trim())}</div>` : "",
    negocio.telefono?.trim() ? `<div class="dato">Tel. ${escapeHtml(negocio.telefono.trim())}</div>` : "",
  ].join("");

  const datos = [
    fila("Folio", cita.codigoConfirmacion),
    fila("Fecha", formatFechaMx(cita.inicioEn)),
    fila("Hora", formatHora(cita.inicioEn)),
    cita.nombreCliente ? fila(terminos.cliente, cita.nombreCliente) : "",
    // En salud el término del sector ("Profesional"); en el resto, "Atendió".
    cita.nombreEmpleado ? fila(esSalud ? terminos.empleado : "Atendió", cita.nombreEmpleado) : "",
  ].join("");

  const totales = [
    r.subtotal ? fila("Subtotal", r.subtotal) : "",
    r.descuento ? fila(r.descuento.etiqueta, r.descuento.monto) : "",
    r.cargoAdicional ? fila("Cargo adicional", r.cargoAdicional) : "",
    r.anticipo ? fila("Anticipo pagado", r.anticipo) : "",
    fila("TOTAL", r.total, "total"),
  ].join("");

  const pagos = [
    ...r.pagos.map((p) => fila(p.etiqueta, p.monto)),
    r.recibido ? fila("Recibido", r.recibido) : "",
    r.cambio ? fila("Cambio", r.cambio) : "",
    r.propina ? fila("Propina", r.propina) : "",
  ].join("");

  const reserva = reservas
    ? `<div class="centro reserva">
        <div class="titulo-reserva">Reserva tu próxima cita</div>
        ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ""}
        <div class="url">${escapeHtml(reservasVisible)}</div>
      </div>`
    : "";

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"/>
<title>Comprobante ${escapeHtml(cita.codigoConfirmacion)}</title>
<style>
  @page { size: ${m.papelMm}mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body {
    width: ${m.papelMm}mm; padding: 4mm ${m.margenMm}mm 5mm;
    font-family: "Consolas", "Menlo", "DejaVu Sans Mono", "Courier New", monospace;
    font-size: ${m.letraPx}px; line-height: 1.35; color: #000;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .centro { text-align: center; }
  .logo { display: block; margin: 0 auto 2mm; max-width: 70%; max-height: ${papel === "80" ? 64 : 48}px; object-fit: contain; filter: grayscale(1) contrast(1.15); }
  .negocio { font-size: ${m.letraPx + 3}px; font-weight: 700; line-height: 1.2; word-break: break-word; }
  .dato { margin-top: 1px; word-break: break-word; }
  .sep { border: 0; border-top: 1px dashed #000; margin: 2.5mm 0; }
  .titulo { font-weight: 700; letter-spacing: 0.08em; }
  .fila { display: flex; justify-content: space-between; align-items: baseline; gap: 2mm; }
  .fila > span:first-child { min-width: 0; word-break: break-word; }
  .monto { white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
  .servicio > span:first-child { font-weight: 700; }
  .total { font-size: ${m.letraPx + 5}px; font-weight: 700; margin-top: 1mm; }
  .titulo-reserva { font-weight: 700; }
  .qr { margin: 2mm auto 1mm; width: ${papel === "80" ? 30 : 24}mm; }
  .qr svg { display: block; width: 100%; height: auto; }
  .url { word-break: break-all; }
  .gracias { margin-top: 3mm; font-weight: 700; }
  .marca { margin-top: 4mm; font-size: ${m.letraPx - 2}px; color: #8a8a8a; }
  .marca img { display: block; height: ${papel === "80" ? 12 : 10}px; width: auto; margin: 0 auto 1mm; filter: grayscale(1); opacity: 0.55; }
  /* Las térmicas son monocromas: el gris no existe en el papel, sale tramado o
     desaparece. En la impresión la marca queda en negro, solo más pequeña. */
  @media print {
    .marca { color: #000; }
    .marca img { opacity: 1; filter: grayscale(1) contrast(1.4); }
  }
</style>
</head><body>
  <div class="centro">${encabezado}</div>
  <hr class="sep"/>
  <div class="centro titulo">COMPROBANTE DE PAGO</div>
  <hr class="sep"/>
  ${datos}
  <hr class="sep"/>
  ${fila(r.servicio.etiqueta, r.servicio.monto, "servicio")}
  <hr class="sep"/>
  ${totales}
  <hr class="sep"/>
  ${pagos}
  <hr class="sep"/>
  ${reserva}
  <div class="centro gracias">Gracias por tu visita</div>
  <div class="centro marca">
    <img src="${escapeHtml(origen)}/logo-appointva.png" alt="AppointVa"/>
    <div>Agenda en línea con AppointVa · appointva.com</div>
  </div>
</body></html>`;
}
