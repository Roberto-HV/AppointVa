import { useRef, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { comprobantesApi } from "../../api/comprobantes";
import { Copy, Check, CalendarClock, Printer, CheckCircle2, XCircle, Star, Bell, Scissors, Upload, Info, Clock, WifiOff, AlertCircle } from "lucide-react";
import { SiWhatsapp, SiApple, SiGooglecalendar } from "react-icons/si";
import PublicFooter from "../../components/PublicFooter";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import { formatPrecio, formatFechaHoraCompleta as formatFechaHora, describirCuandoCita, monogramaNegocio } from "../../utils/formatters";
import { useCopiarAlPortapapeles } from "../../hooks/useCopiarAlPortapapeles";

import { brandSolid, DEFAULT_COLOR } from "../../lib/colorUtils";
import { fondoPortada } from "../../lib/portadaPresets";
import SelloEstado from "../../components/booking/SelloEstado";
import SocialLinks from "../../components/icons/SocialLinks";
import PasoFechaHora from "../../components/booking/PasoFechaHora";
import type { ConfirmacionCita, SlotDisponible } from "../../types";
import { getSectorTerms } from "../../hooks/useSectorTerms";

const estadoHttp = (err: unknown) => (err as { response?: { status?: number } })?.response?.status;

/** Lo que la página promete según el estado real de la cita activa. */
/**
 * "otro": cualquier estado que no es Pendiente ni Confirmada y no tiene pantalla
 * propia (Cancelada y Completada sí la tienen), p. ej. "Inasistencia" o un
 * estado nuevo. Se muestra tal cual, en tono neutro, sin decir "por confirmar".
 */
type EstadoVisibleCita = "confirmada" | "falta-anticipo" | "revisando-anticipo" | "pendiente" | "otro";

function estadoVisibleCita(
  cita: Pick<ConfirmacionCita, "estadoTexto" | "requiereAnticipo" | "comprobanteUrl">,
  comprobanteSubido = false
): EstadoVisibleCita {
  if (cita.estadoTexto === "Confirmada") return "confirmada";
  if (cita.estadoTexto !== "Pendiente") return "otro";
  if (cita.requiereAnticipo) {
    return cita.comprobanteUrl || comprobanteSubido ? "revisando-anticipo" : "falta-anticipo";
  }
  return "pendiente";
}

interface TextosEstado {
  subtitulo: string;
  /** Texto del sello sobre el talón. */
  sello: string;
  paso: string;
  detallePaso: string;
}

function textosDeEstado(estado: EstadoVisibleCita, estadoTexto: string): TextosEstado {
  if (estado !== "otro") return TEXTOS_ESTADO[estado];
  const etiqueta = estadoTexto.trim() || "Sin estado";
  return {
    sello: etiqueta,
    subtitulo: "Si tienes dudas sobre tu cita, comunícate con el negocio",
    paso: etiqueta,
    detallePaso: "Es el estado que registró el negocio para esta cita",
  };
}

const TEXTOS_ESTADO: Record<Exclude<EstadoVisibleCita, "otro">, TextosEstado> = {
  confirmada: {
    sello: "Confirmada",
    subtitulo: "Guarda tu código o comparte por WhatsApp",
    paso: "Cita confirmada",
    detallePaso: "Guarda tu código, lo necesitarás el día de tu cita",
  },
  "falta-anticipo": {
    subtitulo: "Falta tu anticipo para confirmarla",
    sello: "Falta anticipo",
    paso: "Falta tu anticipo",
    detallePaso: "Realiza el pago y sube tu comprobante para que el negocio confirme tu cita",
  },
  "revisando-anticipo": {
    subtitulo: "El negocio revisará tu pago y confirmará tu cita",
    sello: "Por confirmar",
    paso: "Pendiente de confirmación",
    detallePaso: "Recibimos tu comprobante; el negocio confirmará tu cita al revisarlo",
  },
  pendiente: {
    subtitulo: "Pendiente de confirmación del negocio",
    sello: "Por confirmar",
    paso: "Pendiente de confirmación",
    detallePaso: "El negocio confirmará tu cita. Guarda tu código para consultarla",
  },
};

/**
 * Respaldo cuando el portapapeles no está disponible o falla (BF-27): el enlace
 * queda a la vista, seleccionado al enfocarlo, para copiarlo a mano. Importa
 * sobre todo a quien reservó sin correo y solo tiene este enlace.
 */
function EnlaceParaCopiar({ url }: { url: string }) {
  return (
    <div role="alert" className="w-full mt-2 text-left">
      <label htmlFor="enlace-copia-manual" className="block text-xs text-slate-600 mb-1">
        No se pudo copiar. Mantén presionado el enlace (o selecciónalo) para copiarlo:
      </label>
      <input
        id="enlace-copia-manual"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800"
      />
    </div>
  );
}

export default function ConfirmacionPage() {
  const { slug, codigo } = useParams<{ slug?: string; codigo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [errorCancelar, setErrorCancelar] = useState("");
  const [reagendando, setReagendando] = useState(false);
  const [slotReag, setSlotReag] = useState<SlotDisponible | null>(null);
  const { copiado: linkCopiado, copiar: copiarCita } = useCopiarAlPortapapeles();
  const { copiado: bannerCopiado, copiar: copiarBanner } = useCopiarAlPortapapeles();
  /** Si el portapapeles falla, el enlace se muestra para copiarlo a mano (BF-27). */
  const [copiaManual, setCopiaManual] = useState<{ origen: "banner" | "cita"; url: string } | null>(null);
  // Si la foto de portada o el logo no cargan, queda la banda de color y el monograma.
  const [portadaFallo, setPortadaFallo] = useState(false);
  const [logoFallo, setLogoFallo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorComprobante, setErrorComprobante] = useState("");
  const [exitoReagenda, setExitoReagenda] = useState(false);

  const { mutate: subirComprobante, isPending: subiendoComprobante, isSuccess: comprobanteSubido } = useMutation({
    mutationFn: (archivo: File) => comprobantesApi.subirComprobante(codigo!, archivo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cita", codigo] }),
    onError: () => {
      setErrorComprobante("No se pudo subir el comprobante. Verifica que el archivo sea una imagen menor a 20 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const { data: cita, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["cita", codigo],
    queryFn: () => publicoApi.obtenerCita(codigo!),
    enabled: !!codigo,
    // Un 404 es definitivo; un fallo de red merece un reintento antes de rendirse.
    retry: (intentos, err) => estadoHttp(err) !== 404 && intentos < 1,
  });

  const { mutate: cancelar, isPending: cancelando } = useMutation({
    mutationFn: () => publicoApi.cancelarCita(codigo!, cita?.emailCliente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cita", codigo] });
      setConfirmandoCancelar(false);
    },
    onError: () => {
      setErrorCancelar("No se pudo cancelar la cita. Intenta de nuevo.");
    },
  });

  const { mutate: reagendar, isPending: confirmandoReag, error: errorReag } = useMutation({
    mutationFn: () => publicoApi.reagendarCita(codigo!, slotReag!.inicio, cita?.emailCliente),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cita", codigo] });
      setReagendando(false);
      setSlotReag(null);
      setExitoReagenda(true);
      setTimeout(() => setExitoReagenda(false), 5000);
    },
  });


  const negocioSlug = slug ?? cita?.negocioSlug ?? "";
  const linkCita = `${window.location.origin}/cita/${codigo}`;

  useTituloPagina(cita ? `Tu cita en ${cita.nombreNegocio}` : null);

  // OG meta tags dinámicos para compartir en redes sociales
  useEffect(() => {
    if (!cita) return;
    const title = `Tu cita en ${cita.nombreNegocio} · AppointVa`;
    const desc = `${cita.estadoTexto === "Confirmada" ? "Cita confirmada" : "Cita agendada"}: ${cita.nombreServicio} con ${cita.nombreEmpleado}. Gestiona tu reserva en línea.`;
    const setMeta = (prop: string, val: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
      el.setAttribute("content", val);
    };
    setMeta("og:title", title);
    setMeta("og:description", desc);
    setMeta("og:url", linkCita);
  }, [cita, linkCita]);

  const copiar = async (origen: "banner" | "cita", url: string, copiarCon: (texto: string) => Promise<boolean>) => {
    setCopiaManual((await copiarCon(url)) ? null : { origen, url });
  };
  const copiarLink = () => copiar("cita", linkCita, copiarCita);
  const copiarLinkBanner = () => copiar("banner", window.location.href, copiarBanner);

  const { data: negocioPublico } = useQuery({
    queryKey: ["negocio", negocioSlug],
    queryFn: () => publicoApi.obtenerNegocio(negocioSlug),
    enabled: !!negocioSlug,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // El mismo término que usó el flujo de reserva ("Profesional" en salud) (BF-25).
  // El sector viene en la propia cita (B4), así no depende de la consulta del
  // negocio, que falta o falla tras una visita directa; esa queda de respaldo.
  const sector = cita?.sector ?? negocioPublico?.sector;
  const terms = getSectorTerms(sector);

  const irAlNegocio = () => navigate(negocioSlug ? `/b/${negocioSlug}` : "/");

  if (isLoading) {
    return (
      <div role="status" className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div aria-hidden="true" className="w-6 h-6 border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin" />
        <span className="sr-only">Cargando tu cita…</span>
      </div>
    );
  }

  if (isError || !cita) {
    // Un fallo de red no significa que la cita no exista: decirlo así llevaría a
    // reservar de nuevo. Solo un 404 es «no encontrada».
    const noExiste = !isError || estadoHttp(error) === 404;
    const BTN_ERROR = "min-h-[44px] inline-flex items-center justify-center rounded-xl px-5 text-sm font-semibold transition";
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          {noExiste
            ? <XCircle size={40} className="text-slate-400 mx-auto mb-4" aria-hidden="true" />
            : <WifiOff size={40} className="text-slate-400 mx-auto mb-4" aria-hidden="true" />}
          <h1 className="text-slate-800 font-semibold mb-1">
            {noExiste ? "Cita no encontrada" : "No pudimos cargar tu cita"}
          </h1>
          <p className="text-slate-600 text-sm">
            {noExiste
              ? "Revisa que el enlace o el código estén completos."
              : "Verifica tu conexión e intenta de nuevo. Tu cita no se ha perdido."}
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            {!noExiste && (
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className={`${BTN_ERROR} bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-60`}
              >
                {isFetching ? "Reintentando…" : "Reintentar"}
              </button>
            )}
            {slug ? (
              <>
                <Link to={`/b/${slug}/mis-citas`} className={`${BTN_ERROR} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
                  Ver mis citas
                </Link>
                <button type="button" onClick={irAlNegocio} className={`${BTN_ERROR} text-slate-700 hover:underline`}>
                  Hacer una reserva
                </button>
              </>
            ) : (
              <Link to="/" className={`${BTN_ERROR} text-slate-700 hover:underline`}>
                Ir al inicio
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const cancelada = cita.estadoTexto === "Cancelada";
  const completada = cita.estadoTexto === "Completada";
  const cancelable = cita.estadoTexto === "Pendiente" || cita.estadoTexto === "Confirmada";
  const horasCancelacion = cita.horasCancelacion ?? 0;
  const minutosRestantes = (new Date(cita.inicioEn).getTime() - Date.now()) / 60000;
  const puedeCancel = cancelable && minutosRestantes > 0 && (horasCancelacion === 0 || minutosRestantes > horasCancelacion * 60);

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
          <p className="text-slate-500 text-sm mb-3">
            Gracias por tu visita a <strong className="text-slate-700">{cita.nombreNegocio}</strong>. ¡Esperamos verte pronto!
          </p>
          <p className="text-slate-400 text-xs mb-8">
            ¿Cómo fue tu experiencia? Revisa tu correo para dejar una reseña.
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

  // ── Cita activa (Pendiente / Confirmada) u otro estado sin pantalla propia ──
  const color = cita.colorPrimario ?? DEFAULT_COLOR;
  const estadoVisible = estadoVisibleCita(cita, comprobanteSubido);
  const textosEstado = textosDeEstado(estadoVisible, cita.estadoTexto);
  const confirmada = estadoVisible === "confirmada";
  const otroEstado = estadoVisible === "otro";
  const colorSolido = brandSolid(color);
  const portadaUrl = portadaFallo ? undefined : negocioPublico?.portadaUrl;
  const logoUrl = logoFallo ? undefined : negocioPublico?.logoUrl;
  // La banda siempre lleva el fondo de portada que el negocio eligió (o su
  // color): mientras la foto carga, o si falla, no queda un hueco gris.
  const fondoBanda = fondoPortada(negocioPublico?.portadaPreset, color);
  const cuando = describirCuandoCita(cita.inicioEn);
  // Una cita cuya hora ya pasó no puede decir "te esperamos"; si fue hoy aún "es".
  const titular = !cuando
    ? (otroEstado ? "Tu cita" : "Te esperamos")
    : !cuando.yaInicio && !otroEstado
    ? `Te esperamos ${cuando.texto}`
    : cuando.dias >= 0
    ? `Tu cita es ${cuando.texto}`
    : `Tu cita fue ${cuando.texto}`;
  const BTN_CALENDARIO = "flex-1 min-h-[48px] flex items-center justify-center gap-2 rounded-xl text-white text-sm font-semibold transition hover:opacity-90";

  // Pagar el anticipo es lo que confirma la cita: si falta, el panel va justo
  // bajo el talón; si ya se envió el comprobante, baja con el resto.
  const panelAnticipo = cita.requiereAnticipo && !cancelada && !completada && !otroEstado && (
      <div className={`mt-5 rounded-xl border px-5 py-4 print:hidden ${
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
            <p className="text-sm font-semibold text-amber-800 mb-3">Anticipo requerido</p>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Para confirmar tu cita, realiza un pago de{" "}
              <span className="text-slate-900 font-bold">{formatPrecio(cita.montoAnticipo)}</span>
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
                setErrorComprobante("");
                const archivo = e.target.files?.[0];
                if (archivo) {
                  if (archivo.size > 20 * 1024 * 1024) {
                    setErrorComprobante("No se pudo subir el comprobante. Verifica que el archivo sea una imagen menor a 20 MB.");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    return;
                  }
                  subirComprobante(archivo);
                }
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
            {errorComprobante && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-2">{errorComprobante}</p>
            )}
          </>
        )}
      </div>
    );

  return (
    <div data-sector={sector === "salud" ? "salud" : undefined} className="min-h-screen bg-slate-50 print:bg-white">
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

      {/* Banda corta del negocio: su foto de portada o su color, con logo y nombre encima */}
      <header className="print:hidden">
        <div data-testid="banda-negocio" aria-hidden="true" className="h-24 sm:h-28 w-full overflow-hidden" style={fondoBanda}>
          {portadaUrl && (
            <img
              src={portadaUrl}
              alt=""
              onError={() => setPortadaFallo(true)}
              className="w-full h-full object-cover"
              style={{ objectPosition: negocioPublico?.portadaObjectPosition ?? "center" }}
            />
          )}
        </div>
        <div className="max-w-md mx-auto px-4 flex flex-col items-center text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              onError={() => setLogoFallo(true)}
              className="-mt-8 w-16 h-16 rounded-xl object-cover bg-white ring-4 ring-slate-50"
            />
          ) : (
            <div
              aria-hidden="true"
              className="-mt-8 w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-semibold ring-4 ring-slate-50"
              style={{ background: colorSolido }}
            >
              {monogramaNegocio(cita.nombreNegocio)}
            </div>
          )}
          <p className="mt-2 text-sm font-semibold text-slate-700">{cita.nombreNegocio}</p>
          <h1 className="font-display mt-4 text-[1.75rem] sm:text-3xl leading-tight font-semibold tracking-[-0.02em] text-slate-900 text-balance">
            {titular}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{textosEstado.subtitulo}</p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6">

        {!cita.emailCliente && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-2.5 print:hidden">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-snug">
                Sin correo registrado — guarda el enlace de tu cita o búscate en{" "}
                <strong>Mis Citas</strong> con tu correo y teléfono.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={copiarLinkBanner}
                aria-label={bannerCopiado ? "Enlace de esta página copiado" : "Copiar enlace de esta página"}
                className="text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition"
              >
                {bannerCopiado ? "¡Copiado!" : "Copiar enlace"}
              </button>
              <Link
                to={`/b/${negocioSlug}/mis-citas`}
                className="text-amber-700 border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-amber-100 transition"
              >
                Ver mis citas
              </Link>
            </div>
            {copiaManual?.origen === "banner" && <EnlaceParaCopiar url={copiaManual.url} />}
          </div>
        )}

        {exitoReagenda && (
          <div role="status" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0" aria-hidden="true" />
            <span className="text-emerald-700 text-sm font-medium">Tu cita fue reagendada correctamente</span>
          </div>
        )}

        {/* Comprobante: talón con el código y el sello, borde perforado y el detalle */}
        <div id="comprobante-cita" className="[filter:drop-shadow(0_1px_2px_rgb(31_27_22/0.08))_drop-shadow(0_4px_12px_rgb(31_27_22/0.06))]">

          {/* Talón */}
          <div className="bg-white rounded-t-xl px-5 pt-5 pb-4">
            {/* Cabecera print-only */}
            <div className="hidden print:block text-center pb-4 mb-4 border-b-2 border-dashed border-slate-200">
              <p className="font-bold text-base text-slate-900">{cita.nombreNegocio}</p>
              <p className="text-xs text-slate-400 mt-0.5">Comprobante de cita · AppointVa</p>
            </div>

            <p className="text-sm text-slate-500 mb-1">Código de confirmación</p>
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 font-mono text-2xl font-bold text-slate-900 tracking-[0.2em] uppercase">
                {cita.codigoConfirmacion}
              </span>
              <span className="shrink-0">
                <span className="sr-only">Estado de la cita: </span>
                <SelloEstado etiqueta={textosEstado.sello} tono={confirmada ? "confirmado" : otroEstado ? "neutro" : "pendiente"} />
              </span>
            </div>
          </div>

          <div className="talon-perforado" aria-hidden="true" />

          {/* Detalles de la cita */}
          <div className="bg-white rounded-b-xl">
          <div className="px-5 pt-3 pb-4 space-y-3">
            {[
              { label: "Negocio",     valor: cita.nombreNegocio,  hide: "print:hidden" },
              { label: "Servicio",    valor: cita.nombreServicio },
              { label: terms.empleado, valor: cita.nombreEmpleado },
              { label: "Cliente",     valor: cita.nombreCliente },
            ].map(({ label, valor, hide }) => (
              <div key={label} className={`flex justify-between items-center ${hide ?? ""}`}>
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm font-semibold text-slate-800">{valor}</span>
              </div>
            ))}
            <div className="flex justify-between items-start">
              <span className="text-sm text-slate-500">Fecha y hora</span>
              <span className="text-sm font-semibold text-slate-800 text-right max-w-[55%]">
                {formatFechaHora(cita.inicioEn)}
              </span>
            </div>
            {cita.notas && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-slate-500">Notas</span>
                <span className="text-sm text-slate-600 text-right max-w-[60%]">{cita.notas}</span>
              </div>
            )}
            {(cita.instagramUrl || cita.facebookUrl || cita.tiktokUrl) && (
              <div className="pt-1">
                <p className="text-sm text-slate-500 mb-2">Síguenos</p>
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
            <span className="text-xl font-bold text-slate-900 tabular-nums">{formatPrecio(cita.precio)}</span>
          </div>

          {/* Pie print */}
          <div className="hidden print:block text-center border-t-2 border-dashed border-slate-200 py-3 px-5">
            <p className="text-[10px] text-slate-400">
              Generado el {new Date().toLocaleString("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            <p className="text-[10px] text-slate-300 mt-0.5">appointva.com</p>
          </div>
          </div>
        </div>

        {estadoVisible === "falta-anticipo" && panelAnticipo}

        {/* Guardar y compartir: justo bajo el talón, es lo que se hace al terminar */}
        <div className="mt-4 space-y-2.5 print:hidden">
          {/* Agregar al calendario — acción principal: es lo que el visitante necesita guardar */}
          {(cita.icalUrl || cita.webcalUrl || cita.googleCalUrl) && (
            <div>
              <p className="text-xs font-semibold text-slate-600 text-center mb-2">Agrégala a tu calendario</p>
              <div className="flex gap-2">
                {(cita.webcalUrl ?? cita.icalUrl) && (
                  <a
                    href={cita.webcalUrl ?? cita.icalUrl}
                    className={BTN_CALENDARIO}
                    style={{ background: colorSolido }}
                  >
                    <SiApple size={18} aria-hidden="true" />
                    Apple Calendar
                  </a>
                )}
                {cita.googleCalUrl && (
                  <a
                    href={cita.googleCalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={BTN_CALENDARIO}
                    style={{ background: colorSolido }}
                  >
                    <SiGooglecalendar size={18} aria-hidden="true" />
                    Google Calendar
                  </a>
                )}
              </div>
            </div>
          )}

          {/* WhatsApp — secundaria; texto oscuro sobre blanco en lugar de blanco sobre #25D366 (~2:1) */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `*${confirmada ? "Cita confirmada" : "Cita agendada"} en ${cita.nombreNegocio}*\n\n` +
              `Servicio: ${cita.nombreServicio}\n` +
              `Con: ${cita.nombreEmpleado}\n` +
              `Fecha: ${formatFechaHora(cita.inicioEn)}\n\n` +
              `Ver o cancelar: ${linkCita}`
            )}`}
            target="_blank"
            rel="noreferrer"
            className="w-full min-h-[48px] flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition"
          >
            <SiWhatsapp size={20} style={{ color: "#128C7E" }} aria-hidden="true" />
            Compartir por WhatsApp
          </a>
        </div>

        {/* ¿Qué sigue? — timeline Adidas/Afterpay style */}
        <div className="mt-5 mb-1 tarjeta bg-white px-5 py-4 print:hidden">
          <p className="text-base font-semibold text-slate-900 mb-4">{otroEstado ? "Estado de tu cita" : "¿Qué sigue?"}</p>
          <div>
            {/* Paso 1: estado real de la cita */}
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${confirmada ? "bg-status-confirmed-dot" : otroEstado ? "bg-status-absent-dot" : "bg-status-pending-dot"}`}>
                  {confirmada
                    ? <Check size={13} className="text-white" strokeWidth={2.5} />
                    : otroEstado
                    ? <Info size={13} className="text-white" strokeWidth={2.5} />
                    : <Clock size={13} className="text-white" strokeWidth={2.5} />}
                </div>
                {!otroEstado && <div className="w-px h-6 bg-slate-200 mt-1" />}
              </div>
              <div className={`pt-0.5 ${otroEstado ? "" : "pb-5"}`}>
                <p className="text-sm font-semibold text-slate-800">{textosEstado.paso}</p>
                <p className="text-xs text-slate-500 mt-0.5">{textosEstado.detallePaso}</p>
              </div>
            </div>
            {/* Recordatorio y día de la cita solo tienen sentido si la cita sigue en pie. */}
            {!otroEstado && (<>
            {/* Paso 2: Recordatorio */}
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-7 h-7 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center">
                  <Bell size={12} className="text-slate-300" />
                </div>
                <div className="w-px h-6 bg-slate-100 mt-1" />
              </div>
              <div className="pb-5 pt-0.5">
                <p className="text-sm font-semibold text-slate-700">Recordatorio</p>
                {/* Solo se promete el canal que existe: sin correo no hay recordatorio por email. */}
                <p className="text-xs text-slate-500 mt-0.5">
                  {cita.emailCliente
                    ? "Te enviaremos un recordatorio por correo antes de tu cita"
                    : "Guarda el enlace de tu cita: sin correo no podemos enviarte recordatorios por email"}
                </p>
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
                <p className="text-sm font-semibold text-slate-700">¡Tu cita!</p>
                <p className="text-xs text-slate-600 mt-0.5">{formatFechaHora(cita.inicioEn)}</p>
              </div>
            </div>
            </>)}
          </div>
        </div>

        {estadoVisible !== "falta-anticipo" && panelAnticipo}

        {/* Acciones */}
        <div className="mt-4 space-y-2.5 print:hidden">
          {/* Enlace y acciones secundarias */}
          <div className="flex items-center justify-center gap-4 pt-1 flex-wrap">
            <button
              onClick={copiarLink}
              aria-label={linkCopiado ? "Enlace de la cita copiado" : "Copiar enlace de la cita"}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              {linkCopiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {linkCopiado ? "¡Enlace copiado!" : "Copiar enlace"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
            >
              <Printer size={13} />
              Imprimir
            </button>
          </div>
          {copiaManual?.origen === "cita" && <EnlaceParaCopiar url={copiaManual.url} />}

          {cancelable && !confirmandoCancelar && !reagendando && puedeCancel && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReagendando(true)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition"
              >
                Reagendar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoCancelar(true)}
                className="flex-1 min-h-[44px] rounded-xl border border-red-200 bg-white hover:bg-red-50 text-sm font-medium text-red-600 transition"
              >
                Cancelar cita
              </button>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 flex items-center justify-center">
            <button
              type="button"
              onClick={irAlNegocio}
              className="min-h-[44px] px-3 text-sm text-slate-700 hover:underline font-semibold"
            >
              Hacer otra reserva
            </button>
          </div>

          {cancelable && horasCancelacion > 0 && !reagendando && !confirmandoCancelar && (
            <p className="text-xs text-center text-slate-400">
              Cancelaciones con al menos {horasCancelacion} hora{horasCancelacion === 1 ? "" : "s"} de anticipación.
            </p>
          )}
          {cancelable && !puedeCancel && horasCancelacion > 0 && (
            <p className="text-xs text-center text-red-600 font-medium">
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
                diasAnticipacionMinima={cita.diasAnticipacionMinima}
              />
              {horasCancelacion > 0 && (
                <p className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                  <AlertCircle size={13} className="shrink-0 text-slate-500" aria-hidden="true" />
                  <span>
                    Cancelación gratuita hasta{" "}
                    <strong>{horasCancelacion} hora{horasCancelacion === 1 ? "" : "s"}</strong>{" "}
                    antes de la cita.
                  </span>
                </p>
              )}
              {slotReag && new Date(slotReag.inicio).getTime() === new Date(cita.inicioEn).getTime() && (
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
                  disabled={!slotReag || confirmandoReag || (!!slotReag && new Date(slotReag.inicio).getTime() === new Date(cita.inicioEn).getTime())}
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

