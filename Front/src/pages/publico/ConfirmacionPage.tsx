import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { Copy, Check, Calendar, ChevronDown, CalendarClock } from "lucide-react";

function formatFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).replace(/\bDe\b/g, "de");
}

function formatPrecio(precio: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(precio);
}

export default function ConfirmacionPage() {
  const { slug, codigo } = useParams<{ slug?: string; codigo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [reagendando, setReagendando] = useState(false);
  const [fechaReag, setFechaReag] = useState("");
  const [slotReag, setSlotReag] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [calAbierto, setCalAbierto] = useState(false);

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
  });

  const { mutate: reagendar, isPending: confirmandoReag, error: errorReag } = useMutation({
    mutationFn: () => publicoApi.reagendarCita(codigo!, slotReag),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cita", codigo] });
      setReagendando(false);
      setFechaReag("");
      setSlotReag("");
    },
  });

  const { data: slotsDisp = [], isFetching: cargandoSlots } = useQuery({
    queryKey: ["slots-reag-pub", cita?.servicioId, cita?.empleadoId, fechaReag],
    queryFn: () => publicoApi.obtenerDisponibilidad(cita!.servicioId, cita!.empleadoId, fechaReag),
    enabled: reagendando && !!cita && !!fechaReag,
  });

  const negocioSlug = slug ?? cita?.negocioSlug ?? "";
  const linkCita = `${window.location.origin}/cita/${codigo}`;

  const copiarLink = () => {
    navigator.clipboard.writeText(linkCita);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  };

  const irAlNegocio = () => navigate(negocioSlug ? `/b/${negocioSlug}` : "/");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  if (isError || !cita) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 font-medium mb-4">Cita no encontrada</p>
          {slug && (
            <button onClick={irAlNegocio} className="text-primary text-sm hover:underline">
              Hacer una reserva
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

  // ── Vista: cita cancelada ────────────────────────────────────────────────────
  if (cancelada) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cita cancelada</h1>
          <p className="text-gray-500 text-sm mb-1">
            Tu cita de <strong>{cita.nombreServicio}</strong> en{" "}
            <strong>{cita.nombreNegocio}</strong> ha sido cancelada.
          </p>
          <p className="text-gray-400 text-sm mb-8 capitalize">
            {formatFechaHora(cita.inicioEn)}
          </p>
          <button
            onClick={() => irAlNegocio()}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold transition"
          >
            Reservar nueva cita
          </button>
        </div>
      </div>
    );
  }

  // ── Vista: cita completada ───────────────────────────────────────────────────
  if (completada) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Servicio completado!</h1>
          <p className="text-gray-500 text-sm mb-8">
            Gracias por tu visita a <strong>{cita.nombreNegocio}</strong>. ¡Esperamos verte pronto!
          </p>
          <button
            onClick={() => irAlNegocio()}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold transition"
          >
            Reservar otra cita
          </button>
        </div>
      </div>
    );
  }

  // ── Vista: cita activa (Pendiente / Confirmada) ──────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 print:bg-white print:block print:p-8">
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

      <div className="w-full max-w-md">
        {/* Encabezado — solo pantalla */}
        <div className="text-center mb-6 print:hidden">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">¡Cita agendada!</h1>
          <p className="text-gray-500 text-sm mt-1">Guarda tu código de confirmación</p>
        </div>

        {/* Comprobante — visible en pantalla y al imprimir */}
        <div id="comprobante-cita" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Cabecera de recibo — solo en print */}
          <div className="hidden print:block text-center px-5 pt-5 pb-4 border-b-2 border-dashed border-gray-200">
            <p className="font-bold text-base text-gray-900 tracking-tight">{cita.nombreNegocio}</p>
            <p className="text-xs text-gray-400 mt-0.5">Comprobante de cita · AppointVa</p>
          </div>

          {/* Badge código */}
          <div className="flex justify-center py-4 border-b border-gray-50">
            <span className="bg-gray-900 text-white font-mono text-lg font-bold px-6 py-2 rounded-xl tracking-widest">
              {cita.codigoConfirmacion}
            </span>
          </div>

          {/* Detalles */}
          <div className="px-5 py-4 space-y-2.5">
            {[
              { label: "Negocio",      valor: cita.nombreNegocio,  cls: "print:hidden" },
              { label: "Servicio",     valor: cita.nombreServicio },
              { label: "Profesional",  valor: cita.nombreEmpleado },
              { label: "Cliente",      valor: cita.nombreCliente },
            ].map(({ label, valor, cls }) => (
              <div key={label} className={`flex justify-between ${cls ?? ""}`}>
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-800">{valor}</span>
              </div>
            ))}
            <div className="flex justify-between items-start">
              <span className="text-sm text-gray-500">Fecha y hora</span>
              <span className="text-sm font-medium text-gray-800 text-right capitalize max-w-[55%]">
                {formatFechaHora(cita.inicioEn)}
              </span>
            </div>
            {cita.notas && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Notas</span>
                <span className="text-sm text-gray-700 text-right max-w-[60%]">{cita.notas}</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="mx-5 border-t-2 border-dashed border-gray-200 pt-3 pb-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-lg font-bold text-primary">{formatPrecio(cita.precio)}</span>
          </div>

          {/* Pie solo en print */}
          <div className="hidden print:block text-center border-t-2 border-dashed border-gray-200 py-3 px-5">
            <p className="text-[10px] text-gray-400">
              Generado el {new Date().toLocaleString("es-MX", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[10px] text-gray-300 mt-0.5">appointva.com</p>
          </div>
        </div>

        {/* Acciones — ocultas al imprimir */}
        <div className="mt-5 space-y-3 print:hidden">

          {/* 1. WhatsApp — acción principal */}
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
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 32 32" fill="currentColor">
              <path d="M16.003 0C7.164 0 0 7.164 0 16.003c0 2.82.737 5.463 2.027 7.759L0 32l8.484-2.003A15.93 15.93 0 0016.003 32C24.836 32 32 24.836 32 16.003 32 7.164 24.836 0 16.003 0zm0 29.282a13.218 13.218 0 01-6.74-1.843l-.484-.287-5.03 1.188 1.213-4.908-.316-.506A13.197 13.197 0 012.718 16c0-7.327 5.959-13.283 13.285-13.283 7.327 0 13.283 5.956 13.283 13.283 0 7.327-5.956 13.282-13.283 13.282zm7.29-9.934c-.398-.2-2.362-1.166-2.728-1.3-.366-.133-.632-.2-.898.2-.267.4-1.032 1.3-1.265 1.566-.233.267-.466.3-.865.1-.398-.2-1.682-.62-3.204-1.977-1.184-1.056-1.984-2.36-2.216-2.758-.233-.4-.025-.616.174-.814.179-.179.4-.466.6-.7.2-.233.266-.4.4-.666.133-.267.066-.5-.033-.7-.1-.2-.898-2.162-1.232-2.96-.324-.778-.655-.672-.898-.684-.232-.013-.5-.013-.765-.013-.267 0-.7.1-1.065.5-.366.4-1.398 1.365-1.398 3.328s1.432 3.86 1.632 4.127c.2.267 2.818 4.302 6.825 6.03.953.414 1.698.66 2.279.844.958.306 1.83.263 2.52.16.769-.115 2.362-.965 2.695-1.897.333-.933.333-1.732.233-1.899-.1-.166-.366-.266-.765-.466z"/>
            </svg>
            Compartir por WhatsApp
          </a>

          {/* 2. Guardar comprobante */}
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Guardar comprobante
          </button>

          {/* 3. Agregar al calendario — colapsable */}
          {(cita.icalUrl || cita.googleCalUrl) && (
            <div>
              <button
                onClick={() => setCalAbierto((v) => !v)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium transition"
              >
                <Calendar size={15} />
                Agregar al calendario
                <ChevronDown size={14} className={`transition-transform ${calAbierto ? "rotate-180" : ""}`} />
              </button>
              {calAbierto && (
                <div className="flex gap-2 mt-2">
                  {(cita.webcalUrl ?? cita.icalUrl) && (
                    <a
                      href={cita.webcalUrl ?? cita.icalUrl}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold transition"
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
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition"
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

          {/* 4. Copiar enlace — sutil */}
          <div className="flex justify-center">
            <button
              onClick={copiarLink}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              {linkCopiado ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {linkCopiado ? "¡Enlace copiado!" : "Copiar enlace de tu cita"}
            </button>
          </div>

          {/* 5. Links secundarios */}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-center gap-5 flex-wrap">
            <button
              onClick={() => irAlNegocio()}
              className="text-sm text-primary hover:underline font-medium"
            >
              Hacer otra reserva
            </button>

            {cancelable && !confirmandoCancelar && !reagendando && puedeCancel && (
              <button
                onClick={() => setReagendando(true)}
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
              >
                Reagendar
              </button>
            )}

            {cancelable && !confirmandoCancelar && !reagendando && puedeCancel && (
              <button
                onClick={() => setConfirmandoCancelar(true)}
                className="text-sm text-red-500 hover:text-red-600 hover:underline"
              >
                Cancelar cita
              </button>
            )}
          </div>

          {cancelable && horasCancelacion > 0 && !reagendando && !confirmandoCancelar && (
            <p className="text-xs text-center text-gray-400">
              Cancelaciones permitidas con al menos {horasCancelacion} hora{horasCancelacion === 1 ? "" : "s"} de anticipación.
            </p>
          )}

          {cancelable && !puedeCancel && horasCancelacion > 0 && (
            <p className="text-xs text-center text-red-400 font-medium">
              Este negocio no permite cambios con menos de {horasCancelacion} hora{horasCancelacion === 1 ? "" : "s"} de anticipación.
            </p>
          )}

          {/* Panel reagendar */}
          {reagendando && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock size={15} className="text-blue-500" />
                <p className="text-sm font-semibold text-gray-800">Elige una nueva fecha y hora</p>
              </div>
              <input
                type="date"
                value={fechaReag}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => { setFechaReag(e.target.value); setSlotReag(""); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-primary bg-white"
              />
              {fechaReag && (
                cargandoSlots ? (
                  <p className="text-xs text-gray-400 text-center py-2">Cargando horarios...</p>
                ) : slotsDisp.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-2">Sin disponibilidad ese día. Elige otra fecha.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                    {slotsDisp.map((s) => (
                      <button
                        key={s.inicio}
                        onClick={() => setSlotReag(s.inicio)}
                        className={`py-1.5 text-xs font-medium rounded-lg border transition ${
                          slotReag === s.inicio
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-700 border-gray-200 hover:border-primary"
                        }`}
                      >
                        {s.horaTexto}
                      </button>
                    ))}
                  </div>
                )
              )}
              {errorReag && (
                <p className="text-xs text-red-500 text-center">
                  {(errorReag as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "No se pudo reagendar"}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setReagendando(false); setFechaReag(""); setSlotReag(""); }}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => reagendar()}
                  disabled={!slotReag || confirmandoReag}
                  className="flex-1 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-semibold disabled:opacity-50 transition"
                >
                  {confirmandoReag ? "Reagendando..." : "Confirmar cambio"}
                </button>
              </div>
            </div>
          )}

          {confirmandoCancelar && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-700 mb-3">¿Seguro que deseas cancelar tu cita?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmandoCancelar(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  No, mantenerla
                </button>
                <button
                  onClick={() => cancelar()}
                  disabled={cancelando}
                  className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60 transition"
                >
                  {cancelando ? "Cancelando..." : "Sí, cancelar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
