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
  /** Los renglones arriba del TOTAL: Subtotal, descuentos, cargo y anticipo. */
  totales: RenglonTicket[];
  total: string;
  /** Debajo del TOTAL, solo cuando el anticipo superó lo que se debía. */
  saldoAFavor: RenglonTicket | null;
  /** Métodos de pago, Recibido, Cambio y Propina. */
  pagos: RenglonTicket[];
  /** Quién atendió: el término del sector en salud, «Atendió» en el resto. */
  etiquetaEmpleado: string;
}

/** "$1,280.00": siempre con centavos, como en cualquier ticket. */
export function dinero(n: number): string {
  return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A centavos, con el medio centavo hacia arriba: igual que
 * Math.Round(x, 2, MidpointRounding.AwayFromZero) en el servidor.
 */
const centavos = (n: number) => Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;

/** Montos ya redondeados: cualquier residuo menor a medio centavo es cero. */
const positivo = (n: number) => n > 0.005;

/** "10", "12.5": el porcentaje del cupón tal como se escribe en el ticket. */
const porcentaje = (pct: number) => String(centavos(pct));

/**
 * Quién atendió: el término del sector en salud ("Profesional"), «Atendió» en
 * el resto. El correo del servidor (EmailService.EtiquetaEmpleado) usa el mismo.
 */
export function etiquetaEmpleadoTicket(sector: string | null | undefined): string {
  return sector === "salud" ? getSectorTerms(sector).empleado : "Atendió";
}

/**
 * Reparte el cobro en renglones que cierran en el papel:
 * Subtotal − Descuento − Descuento en caja − Anticipo (+ Cargo adicional) = TOTAL.
 *
 * - El cupón sale solo de lo guardado en la reserva (`precioLista`): una cita sin
 *   esos datos no muestra cupón, cueste lo que cueste hoy el servicio.
 * - Si en caja se cobró menos de lo que se debía, la diferencia es «Descuento en
 *   caja»; si se cobró más, «Cargo adicional».
 * - Un anticipo mayor que lo que se debía se aplica solo hasta el precio
 *   («Anticipo aplicado»); el resto va debajo del TOTAL como «Saldo a favor»,
 *   nunca como cargo.
 * - La propina va en su propio renglón y nunca se suma al TOTAL: el cambio se
 *   calcula sin ella y «Recibido − TOTAL = Cambio» tiene que cerrar.
 *
 * El correo (EmailService.ResumirTicket) sigue las mismas reglas; los vectores de
 * AppointVaAPI.Tests/Fixtures/ticket-vectores.json lo comprueban en los dos lados.
 */
export function resumirTicket(cita: CitaDto, sector?: string | null): ResumenTicket {
  const precio = centavos(cita.precio);
  const lista = cita.precioLista != null ? centavos(cita.precioLista) : null;
  const precioLista = lista != null && positivo(lista - precio) ? lista : precio;
  const anticipoTotal = cita.anticipoRecibido && cita.montoAnticipo != null && positivo(centavos(cita.montoAnticipo))
    ? centavos(cita.montoAnticipo)
    : 0;
  const anticipo = Math.min(anticipoTotal, precio);
  const saldoAFavor = centavos(anticipoTotal - anticipo);
  const cobrado = centavos(Math.max(0, cita.montoCobrado ?? precio - anticipo));

  const descuentoCupon = centavos(precioLista - precio);
  const diferenciaCaja = centavos(precio - anticipo - cobrado);
  const descuentoCaja = Math.max(0, diferenciaCaja);
  const cargo = Math.max(0, -diferenciaCaja);

  const totales: RenglonTicket[] = [];
  if (positivo(descuentoCupon) || positivo(descuentoCaja) || positivo(cargo) || positivo(anticipoTotal)) {
    totales.push({ etiqueta: "Subtotal", monto: dinero(precioLista) });
  }
  if (positivo(descuentoCupon)) {
    const pct = cita.descuentoPorcentaje;
    const etiqueta = pct != null && pct > 0 ? `Descuento ${porcentaje(pct)}%` : "Descuento";
    totales.push({ etiqueta, monto: `-${dinero(descuentoCupon)}` });
  }
  if (positivo(descuentoCaja)) totales.push({ etiqueta: "Descuento en caja", monto: `-${dinero(descuentoCaja)}` });
  if (positivo(cargo)) totales.push({ etiqueta: "Cargo adicional", monto: dinero(cargo) });
  if (positivo(anticipoTotal)) {
    totales.push({
      etiqueta: positivo(saldoAFavor) ? "Anticipo aplicado" : "Anticipo pagado",
      monto: `-${dinero(anticipo)}`,
    });
  }

  // Pago dividido: el primer método se lleva lo que no cubrió el segundo.
  const metodo1 = cita.metodoPago?.trim() || "Pago";
  const metodo2 = cita.metodoPago2?.trim() ?? "";
  const m2 = metodo2 && cita.montoPago2 != null && positivo(centavos(cita.montoPago2)) ? centavos(cita.montoPago2) : 0;
  const pagos: RenglonTicket[] = [];
  if (m2 > 0) {
    pagos.push({ etiqueta: metodo1, monto: dinero(Math.max(0, centavos(cobrado - m2))) });
    pagos.push({ etiqueta: metodo2, monto: dinero(m2) });
  } else {
    pagos.push({ etiqueta: metodo1, monto: dinero(cobrado) });
  }
  const hayEfectivo = metodo1 === "Efectivo" || (m2 > 0 && metodo2 === "Efectivo");
  if (hayEfectivo && cita.montoRecibido != null && positivo(centavos(cita.montoRecibido))) {
    pagos.push({ etiqueta: "Recibido", monto: dinero(centavos(cita.montoRecibido)) });
  }
  if (hayEfectivo && cita.cambio != null && positivo(centavos(cita.cambio))) {
    pagos.push({ etiqueta: "Cambio", monto: dinero(centavos(cita.cambio)) });
  }
  if (cita.propina != null && positivo(centavos(cita.propina))) {
    pagos.push({ etiqueta: "Propina", monto: dinero(centavos(cita.propina)) });
  }

  const duracion = cita.duracionMinutos > 0 ? ` · ${cita.duracionMinutos} min` : "";

  return {
    servicio: { etiqueta: `${cita.nombreServicio}${duracion}`, monto: dinero(precioLista) },
    totales,
    total: dinero(cobrado),
    saldoAFavor: positivo(saldoAFavor) ? { etiqueta: "Saldo a favor", monto: dinero(saldoAFavor) } : null,
    pagos,
    etiquetaEmpleado: etiquetaEmpleadoTicket(sector),
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
  const r = resumirTicket(cita, negocio.sector);
  const terminos = getSectorTerms(negocio.sector);
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
    cita.nombreEmpleado ? fila(r.etiquetaEmpleado, cita.nombreEmpleado) : "",
  ].join("");

  const totales = [
    ...r.totales.map((t) => fila(t.etiqueta, t.monto)),
    fila("TOTAL", r.total, "total"),
    r.saldoAFavor ? fila(r.saldoAFavor.etiqueta, r.saldoAFavor.monto) : "",
  ].join("");

  const pagos = r.pagos.map((p) => fila(p.etiqueta, p.monto)).join("");

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
