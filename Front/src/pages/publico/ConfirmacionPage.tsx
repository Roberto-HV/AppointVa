import { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { comprobantesApi } from "../../api/comprobantes";
import { Copy, Check, Calendar, ChevronDown, CalendarClock, Download, CheckCircle2, XCircle, Star, Bell, Scissors, Upload, Info } from "lucide-react";
import WhatsAppIcon from "../../components/icons/WhatsAppIcon";
import PublicFooter from "../../components/PublicFooter";
import { formatPrecio, formatFechaHoraCompleta as formatFechaHora } from "../../utils/formatters";

import { hexToChannels, DEFAULT_COLOR } from "../../lib/colorUtils";
import SocialLinks from "../../components/icons/SocialLinks";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import type { SlotDisponible } from "../../types";

export default function ConfirmacionPage() {
  const { slug, codigo } = useParams<{ slug?: string; codigo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState("");
  const [reagendando, setReagendando] = useState(false);
  const [slotReag, setSlotReag] = useState<SlotDisponible | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [bannerCopiado, setBannerCopiado] = useState(false);
  const [calAbierto, setCalAbierto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { mutate: subirComprobante, isPending: subiendoComprobante, isSuccess: comprobanteSubido } = useMutation({
    mutationFn: (archivo: File) => comprobantesApi.subirComprobante(codigo!, archivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cita", codigo] }),
  });

  const { data: cita, isLoading, isError } = useQuery({
    queryKey: ["cita", codigo],
    queryFn: () => publicoApi.obtenerCita(codigo!),
    enabled: !!codigo,
  });

  const { mutate: cancelar, isPending: cancelando } = useMutation({
    mutationFn: () => publicoApi.cancelarCita(codigo!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cita", codigo] });
      setConfirmandoCancelar(false);
    },
    onError: () => {
      setErrorCancelar("No se pudo cancelar la cita. Intenta de nuevo.");
    },
  });

  const { mutate: reagendar, isPending: confirmandoReag, error: errorReag } = useMutation({
    mutationFn: () => publicoApi.reagendarCita(codigo!, slotReag!.inicio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cita", codigo] });
      setReagendando(false);
      setSlotReag(null);
    },
  });


  const negocioSlug = slug ?? cita?.negocioSlug ?? "";
  const linkCita = `${window.location.origin}/cita/${codigo}`;

  // OG meta tags dinámicos para compartir en redes sociales
  useEffect(() => {
    if (!cita) return;
    const title = `Tu cita en ${cita.nombreNegocio} — AppointVa`;
    const desc = `Cita confirmada: ${cita.nombreServicio} con ${cita.nombreEmpleado}. Gestiona tu reserva en línea.`;
    document.title = title;
    const setMeta = (prop: string, val: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
      el.setAttribute("content", val);
    };
    setMeta("og:title", title);
    setMeta("og:description", desc);
    setMeta("og:url", linkCita);
    return () => { document.title = "AppointVa — Tu agenda online. Sin llamadas."; };
  }, [cita, linkCita]);

  const copiarLink = () => {
    navigator.clipboard.writeText(linkCita);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  const copiarLinkBanner = () => {
    navigator.clipboard.writeText(window.location.href);
    setBannerCopiado(true);
    setTimeout(() => setBannerCopiado(false), 2000);
  };

  const irAlNegocio = () => navigate(negocioSlug ? `/b/${negocioSlug}` : "/");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !cita) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle size={40} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-700 font-semibold mb-1">Cita no encontrada</p>
          {slug && (
            <button onClick={irAlNegocio} className="text-slate-700 text-sm font-semibold hover:underline mt-3">
              Hacer una reserva →
            </button>
          )}
        </div>
      </div>
    );
  }

  const cancelada = cita.estadoTexto === "Cancelada";
  const completada = cita.estadoTexto === "Completada";
  const cancelable = cita.estadoTexto === "Pendiente" || cita.estadoTexto === "Confirmada";
  const horasCancelacion = cita.horasCancelacion ?? 0;
  const minutosRestantes = (new Date(cita.inicioEn).getTime() - Date.now()) / 60000;
  const puedeCancel = cancelable && (horasCancelacion === 0 || minutosRestantes > horasCancelacion * 60);

  // ── Cita cancelada ──────────────────────────────────────────────────────────
  if (cancelada) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Cita cancelada</h1>
          <p className="text-slate-500 text-sm mb-1">
            Tu cita de <strong className="text-slate-700">{cita.nombreServicio}</strong> en{" "}
            <strong className="text-slate-700">{cita.nombreNegocio}</strong> fue cancelada.
          </p>
          <p className="text-slate-400 text-xs mb-8">{formatFechaHora(cita.inicioEn)}</p>
          <button
            onClick={irAlNegocio}
            className="w-full py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm transition"
          >
            Reservar nueva cita
          </button>
        </div>
      </div>
    );
  }

  // ── Cita completada ─────────────────────────────────────────────────────────
  if (completada) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Star size={32} className="text-emerald-500" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Servicio completado!</h1>
          <p className="text-slate-500 text-sm mb-8">
            Gracias por tu visita a <strong className="text-slate-700">{cita.nombreNegocio}</strong>. ¡Esperamos verte pronto!
          </p>
          <button
            onClick={irAlNegocio}
            className="w-full py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm transition"
          >
            Reservar otra cita
          </button>
        </div>
      </div>
    );
  }

  // ── Cita activa (Pendiente / Confirmada) ────────────────────────────────────
  const color = cita.colorPrimario ?? DEFAULT_COLOR;

  return (
    <div className="min-h-screen bg-[#F8FAFC] print:bg-white">
      <style>{`
        @media print {
          body { background: white !important; margin: 0; }
          body * { visibility: hidden; }
          #comprobante-cita, #comprobante-cita * { visibility: visible; }
          #comprobante-cita {
            position: fixed; top: 0; left: 50%; transform: translateX(-50%);
            width: 360px; border: none !important; box-shadow: none !important;
            border-radius: 0 !important; padding: 24px !important;
          }
        }
      `}</style>

      {/* Header oscuro Style C */}
      <div className="relative flex flex-col items-center justify-center py-10 px-4 print:hidden overflow-hidden"
        style={{ background: "#0C0C0F" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse 70% 80% at 50% 0%, rgb(${hexToChannels(color)} / 0.28) 0%, transparent 100%)`,
        }} />
        <div className="relative z-10 flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `rgb(${hexToChannels(color)} / 0.18)`, border: `1.5px solid rgb(${hexToChannels(color)} / 0.35)` }}>
            <CheckCircle2 size={32} style={{ color }} />
          </div>
          <h1 className="text-2xl font-bold text-white">¡Cita confirmada!</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Guarda tu código o comparte por WhatsApp
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5">

        {!cita.emailCliente && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-2.5 print:hidden">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-snug">
                Sin correo registrado — guarda el enlace de tu cita o búscate en{" "}
                <strong>Mis Citas</strong> con tu teléfono.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={copiarLinkBanner}
                className="text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition"
              >
                {bannerCopiado ? "¡Copiado!" : "Copiar enlace"}
              </button>
              <a
                href={`/b/${negocioSlug}/mis-citas`}
                className="text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition"
              >
                Ver mis citas
              </a>
            </div>
          </div>
        )}

        {/* Comprobante */}
        <div id="comprobante-cita" className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Cabecera print-only */}
          <div className="hidden print:block text-center px-5 pt-5 pb-4 border-b-2 border-dashed border-slate-200">
            <p className="font-bold text-base text-slate-900">{cita.nombreNegocio}</p>
            <p className="text-xs text-slate-400 mt-0.5">Comprobante de cita · AppointVa</p>
          </div>

          {/* Código de confirmación */}
          <div className="flex flex-col items-center py-5" style={{ background: "#0C0C0F" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "rgba(255,255,255,0.35)" }}>Código de confirmación</p>
            <span className="font-mono text-2xl font-black text-white tracking-[0.2em]">
              {cita.codigoConfirmacion}
            </span>
          </div>

          {/* Detalles de la cita */}
          <div className="px-5 py-4 space-y-3">
            {/* Estado — badge estilo Klarna */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Estado</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                cita.estadoTexto === "Confirmada" ? "bg-emerald-50 text-emerald-600" :
                cita.estadoTexto === "Pendiente"  ? "bg-amber-50 text-amber-600" :
                "bg-slate-100 text-slate-600"
              }`}>
                {cita.estadoTexto === "Confirmada" ? "✓ Confirmada" :
                 cita.estadoTexto === "Pendiente"  ? "⏳ Pendiente confirmación" :
                 cita.estadoTexto}
              </span>
            </div>
            {[
              { label: "Negocio",     valor: cita.nombreNegocio,  hide: "print:hidden" },
              { label: "Servicio",    valor: cita.nombreServicio },
              { label: "Profesional", valor: cita.nombreEmpleado },
              { label: "Cliente",     valor: cita.nombreCliente },
            ].map(({ label, valor, hide }) => (
              <div key={label} className={`flex justify-between items-center ${hide ?? ""}`}>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
                <span className="text-sm font-semibold text-slate-800">{valor}</span>
              </div>
            ))}
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha y hora</span>
              <span className="text-sm font-semibold text-slate-800 text-right max-w-[55%]">
                {formatFechaHora(cita.inicioEn)}
              </span>
            </div>
            {cita.notas && (
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Notas</span>
                <span className="text-sm text-slate-600 text-right max-w-[60%]">{cita.notas}</span>
              </div>
            )}
            {(cita.instagramUrl || cita.facebookUrl || cita.tiktokUrl) && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Síguenos</p>
                <SocialLinks
                  instagramUrl={cita.instagramUrl}
                  facebookUrl={cita.facebookUrl}
                  tiktokUrl={cita.tiktokUrl}
                />
              </div>
            )}
          </div>

          {/* Total */}
          <div className="mx-5 border-t border-dashed border-slate-200 pt-3 pb-4 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-700">Total</span>
            <span className="text-xl font-black text-slate-900">{formatPrecio(cita.precio)}</span>
          </div>

          {/* Pie print */}
          <div className="hidden print:block text-center border-t-2 border-dashed border-slate-200 py-3 px-5">
            <p className="text-[10px] text-slate-400">
              Generado el {new Date().toLocaleString("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[10px] text-slate-300 mt-0.5">appointva.com</p>
          </div>
        </div>

        {/* ¿Qué sigue? — timeline Adidas/Afterpay style */}
        <div className="mt-5 mb-1 bg-white rounded-3xl border border-slate-100 shadow-sm px-5 py-4 print:hidden">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">¿Qué sigue?</p>
          <div>
            {/* Paso 1: Confirmado ✓ */}
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <div className="w-px h-6 bg-slate-200 mt-1" />
              </div>
              <div className="pb-5 pt-0.5">
                <p className="text-sm font-semibold text-slate-800">Cita confirmada</p>
                <p className="text-xs text-slate-400 mt-0.5">Guarda tu código, lo necesitarás el día de tu cita</p>
              </div>
            </div>
            {/* Paso 2: Recordatorio */}
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-7 h-7 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center">
                  <Bell size={12} className="text-slate-300" />
                </div>
                <div className="w-px h-6 bg-slate-100 mt-1" />
              </div>
              <div className="pb-5 pt-0.5">
                <p className="text-sm font-semibold text-slate-400">Recordatorio</p>
                <p className="text-xs text-slate-300 mt-0.5">Te avisamos 24h antes por WhatsApp o correo</p>
              </div>
            </div>
            {/* Paso 3: Día de cita */}
            <div className="flex gap-3 items-start">
              <div className="shrink-0">
                <div className="w-7 h-7 rounded-full border-2 border-slate-100 bg-white flex items-center justify-center">
                  <Scissors size={11} className="text-slate-200" />
                </div>
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-slate-400">¡Tu cita!</p>
                <p className="text-xs text-slate-300 mt-0.5">{formatFechaHora(cita.inicioEn)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de anticipo */}
        {cita.requiereAnticipo && !cancelada && !completada && (
          <div className={`mt-5 rounded-3xl border px-5 py-4 print:hidden ${
            cita.comprobanteUrl || comprobanteSubido
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            {cita.comprobanteUrl || comprobanteSubido ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <Check size={17} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Comprobante recibido</p>
                  <p className="text-xs text-emerald-600 mt-0.5">El negocio revisará tu pago y confirmará la cita</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3">Anticipo requerido</p>
                <p className="text-sm font-semibold text-slate-800 mb-1">
                  Para confirmar tu cita, realiza un pago de{" "}
                  <span className="text-slate-900 font-black">{formatPrecio(cita.montoAnticipo)}</span>
                </p>
                {cita.instruccionesAnticipo && (
                  <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-white/70 rounded-xl px-3 py-2 mt-2 mb-3 font-sans leading-relaxed">
                    {cita.instruccionesAnticipo}
                  </pre>
                )}
                <p className="text-xs text-slate-500 mb-3">Después de pagar, sube tu comprobante aquí para agilizar la confirmación:</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) subirComprobante(archivo);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={subiendoComprobante}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold transition"
                >
                  <Upload size={14} />
                  {subiendoComprobante ? "Subiendo..." : "Subir comprobante de pago"}
                </button>
              </>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="mt-4 space-y-2.5 print:hidden">
          {/* WhatsApp — acción principal */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `✅ Cita confirmada en ${cita.nombreNegocio}\n` +
              `📌 Servicio: ${cita.nombreServicio}\n` +
              `👤 Con: ${cita.nombreEmpleado}\n` +
              `📅 ${formatFechaHora(cita.inicioEn)}\n` +
              `🔗 Ver o cancelar: ${linkCita}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-bold transition"
          >
            <WhatsAppIcon className="w-4 h-4 shrink-0" />
            Compartir por WhatsApp
          </a>

          {/* Guardar comprobante */}
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold transition hover:opacity-90"
            style={{ background: "#0C0C0F" }}
          >
            <Download size={15} />
            Guardar comprobante
          </button>

          {/* Agregar al calendario */}
          {(cita.icalUrl || cita.googleCalUrl) && (
            <div>
              <button
                onClick={() => setCalAbierto((v) => !v)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
              >
                <Calendar size={14} />
                Agregar al calendario
                <ChevronDown size={13} className={`transition-transform ${calAbierto ? "rotate-180" : ""}`} />
              </button>
              {calAbierto && (
                <div className="flex gap-2 mt-2">
                  {(cita.webcalUrl ?? cita.icalUrl) && (
                    <a
                      href={cita.webcalUrl ?? cita.icalUrl}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 814 1000" fill="currentColor">
                        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-152.8-99.9C27.7 790 0 697 0 608.3c0-199.8 130.2-305.7 258.2-305.7 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
                      </svg>
                      Apple Calendar
                    </a>
                  )}
                  {cita.googleCalUrl && (
                    <a
                      href={cita.googleCalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <path fill="none" d="M0 0h48v48H0z"/>
                      </svg>
                      Google Calendar
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Enlace y acciones secundarias */}
          <div className="flex items-center justify-center pt-1">
            <button
              onClick={copiarLink}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              {linkCopiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {linkCopiado ? "¡Enlace copiado!" : "Copiar enlace de tu cita"}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-3 flex items-center justify-center gap-5 flex-wrap">
            <button onClick={irAlNegocio} className="text-sm text-slate-700 hover:underline font-semibold">
              Hacer otra reserva
            </button>
            {cancelable && !confirmandoCancelar && !reagendando && puedeCancel && (
              <button
                onClick={() => setReagendando(true)}
                className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
              >
                Reagendar
              </button>
            )}
            {cancelable && !confirmandoCancelar && !reagendando && puedeCancel && (
              <button
                onClick={() => setConfirmandoCancelar(true)}
                className="text-sm text-red-400 hover:text-red-600 hover:underline"
              >
                Cancelar cita
              </button>
            )}
          </div>

          {cancelable && horasCancelacion > 0 && !reagendando && !confirmandoCancelar && (
            <p className="text-xs text-center text-slate-400">
              Cancelaciones con al menos {horasCancelacion} hora{horasCancelacion === 1 ? "" : "s"} de anticipación.
            </p>
          )}
          {cancelable && !puedeCancel && horasCancelacion > 0 && (
            <p className="text-xs text-center text-red-400 font-medium">
              Este negocio no permite cambios con menos de {horasCancelacion} hora{horasCancelacion === 1 ? "" : "s"} de anticipación.
            </p>
          )}

          {/* Panel reagendar */}
          {reagendando && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock size={15} className="text-slate-700" />
                <p className="text-sm font-semibold text-slate-800">Elige nueva fecha y hora</p>
              </div>
              <PasoFechaHora
                servicioId={cita.servicioId}
                empleadoId={cita.empleadoId ?? null}
                seleccionado={slotReag}
                onSeleccionar={setSlotReag}
                onLimpiarSlot={() => setSlotReag(null)}
                color={color}
              />
              {slotReag?.inicio === cita.inicioEn && (
                <p className="text-xs text-amber-600 text-center bg-amber-50 border border-amber-100 rounded-lg py-2 px-3">
                  Este ya es el horario actual de tu cita. Elige una fecha u hora diferente.
                </p>
              )}
              {errorReag && (
                <p className="text-xs text-red-500 text-center">
                  {(errorReag as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "No se pudo reagendar"}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setReagendando(false); setSlotReag(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => reagendar()}
                  disabled={!slotReag || confirmandoReag || slotReag?.inicio === cita.inicioEn}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-50 transition"
                >
                  {confirmandoReag ? "Reagendando…" : "Confirmar"}
                </button>
              </div>
            </div>
          )}

          {confirmandoCancelar && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
              <p className="text-sm text-slate-700 mb-3 font-medium">¿Seguro que deseas cancelar tu cita?</p>
              {errorCancelar && (
                <p className="text-xs text-red-600 mb-3 bg-red-100 rounded-xl px-3 py-2">{errorCancelar}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmandoCancelar(false); setErrorCancelar(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition font-medium"
                >
                  Mantenerla
                </button>
                <button
                  onClick={() => { setErrorCancelar(""); cancelar(); }}
                  disabled={cancelando}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-60 transition"
                >
                  {cancelando ? "Cancelando…" : "Sí, cancelar"}
                </button>
              </div>
            </div>
          )}
        </div>
        <PublicFooter />
      </div>
    </div>
  );
}

