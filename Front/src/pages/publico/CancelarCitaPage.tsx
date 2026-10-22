import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../api/axios";
import PublicFooter from "../../components/PublicFooter";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import { CODIGO_ESTADO_CITA } from "../../lib/estadoCita";
import { esErrorTemporal, mensajeError } from "../../utils/errores";
import { formatFechaLarga, formatHora, formatPrecio } from "../../utils/formatters";

interface CitaResumen {
  codigoConfirmacion: string;
  nombreNegocio: string;
  negocioSlug?: string;
  nombreServicio: string;
  nombreEmpleado: string;
  nombreCliente: string;
  inicioEn: string;
  precio: number;
  estado: number;
  estadoTexto: string;
  horasCancelacion: number;
}

function formatFechaHora(iso: string) {
  return `${formatFechaLarga(iso)} · ${formatHora(iso)}`;
}

function EstadoFinal({ titulo, texto, slug }: { titulo: string; texto: string; slug?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center shadow-sm">
        <p className="font-semibold text-gray-700 mb-1">{titulo}</p>
        <p className="text-sm text-gray-500 mb-4">{texto}</p>
        {slug && (
          <Link
            to={`/b/${slug}`}
            className="inline-flex items-center min-h-[44px] text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 px-5 rounded-xl transition"
          >
            Reservar una nueva cita
          </Link>
        )}
      </div>
    </div>
  );
}

export default function CancelarCitaPage() {
  useTituloPagina("Cancelar cita");
  const { codigo } = useParams<{ codigo: string }>();
  const [email, setEmail] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [cancelada, setCancelada] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: cita, isLoading, isError, error, refetch, isFetching } = useQuery<CitaResumen>({
    queryKey: ["cita-cancelar", codigo],
    queryFn: async () => {
      const r = await api.get(`/publico/citas/${codigo}`);
      return r.data;
    },
    enabled: !!codigo,
    retry: false,
  });

  const { mutate: cancelar, isPending } = useMutation({
    mutationFn: async () => {
      await api.delete(`/publico/citas/${codigo}`, { params: { email: email.trim() } });
    },
    onSuccess: () => setCancelada(true),
    onError: (err) => {
      setErrorMsg(mensajeError(err, "No se pudo cancelar la cita. Verifica tu correo e intenta de nuevo."));
    },
  });

  const handleCancelar = () => {
    setErrorMsg(null);
    cancelar();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p role="status" className="text-gray-500 text-sm">Cargando...</p>
      </div>
    );
  }

  if (isError && esErrorTemporal(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div role="alert" className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center shadow-sm">
          <p className="font-semibold text-gray-800 mb-1">No pudimos cargar tu cita</p>
          <p className="text-sm text-gray-500 mb-4">Revisa tu conexión e intenta de nuevo. Tu enlace puede seguir siendo válido.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="min-h-[44px] px-5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {isFetching ? "Reintentando…" : "Reintentar"}
          </button>
        </div>
      </div>
    );
  }

  if (isError || !cita) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Cita no encontrada</p>
          <p className="text-sm text-gray-500">El enlace puede haber expirado o no es válido.</p>
        </div>
      </div>
    );
  }

  if (cancelada) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Cita cancelada</p>
          <p className="text-sm text-gray-500 mb-4">Tu cita ha sido cancelada exitosamente. Recibirás un correo de confirmación.</p>
          {cita?.negocioSlug && (
            <Link
              to={`/b/${cita.negocioSlug}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-800 px-5 py-2.5 rounded-xl transition"
            >
              Reservar una nueva cita
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Antes se comparaba con 3 (que en el backend es Completada) como si fuera
  // Cancelada. Ahora se usan los códigos reales (AP-18).
  if (cita.estado === CODIGO_ESTADO_CITA.Cancelada) {
    return (
      <EstadoFinal titulo="Esta cita ya está cancelada" texto="No es necesario hacer nada más." slug={cita.negocioSlug} />
    );
  }

  // Una cita completada, marcada como inasistencia o cuya hora ya pasó no se
  // puede cancelar: se dice antes de pedir el correo, no después.
  const minutosRestantes = (new Date(cita.inicioEn).getTime() - Date.now()) / 60000;
  const yaPaso = minutosRestantes <= 0;
  if (
    cita.estado === CODIGO_ESTADO_CITA.Completada ||
    cita.estado === CODIGO_ESTADO_CITA.Inasistencia ||
    yaPaso
  ) {
    return (
      <EstadoFinal
        titulo="Esta cita ya se realizó"
        texto="La fecha de esta cita ya pasó, así que no se puede cancelar."
        slug={cita.negocioSlug}
      />
    );
  }

  const ventanaCancelacionVencida = cita.horasCancelacion > 0 && minutosRestantes <= cita.horasCancelacion * 60;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-700 px-6 py-5 text-center">
          <p className="text-white font-semibold text-base">{cita.nombreNegocio}</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Detalles de tu cita</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Servicio</span>
                <span className="font-medium text-gray-800">{cita.nombreServicio}</span>
              </div>
              {cita.nombreEmpleado && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Con</span>
                  <span className="font-medium text-gray-800">{cita.nombreEmpleado}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Fecha</span>
                <span className="font-medium text-gray-800 text-right">{formatFechaHora(cita.inicioEn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Precio</span>
                <span className="font-medium text-gray-800 tabular-nums">{formatPrecio(cita.precio)}</span>
              </div>
            </div>
          </div>

          {cita.horasCancelacion > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              Esta cita solo puede cancelarse con al menos {cita.horasCancelacion} hora{cita.horasCancelacion === 1 ? "" : "s"} de anticipación.
            </div>
          )}

          {!confirmado ? (
            <>
              <div>
                <label htmlFor="cancel-email" className="block text-xs text-gray-500 mb-1.5">
                  Confirma tu correo electrónico para cancelar
                </label>
                <input
                  id="cancel-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-slate-700"
                />
              </div>
              {ventanaCancelacionVencida && (
                <p className="text-xs text-red-700 text-center">
                  El período de cancelación ha vencido ({cita.horasCancelacion} hora{cita.horasCancelacion === 1 ? "" : "s"} mínimo de anticipación).
                </p>
              )}
              {errorMsg && (
                <p role="alert" className="text-xs text-red-700">{errorMsg}</p>
              )}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700">
                ¿Prefieres cambiar el horario?{" "}
                <Link to={`/cita/${cita.codigoConfirmacion}`} className="font-semibold underline hover:text-slate-900">
                  Reagendar
                </Link>
              </div>
              <button
                type="button"
                onClick={() => {
                  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
                  if (!emailValido) { setErrorMsg("Ingresa un correo electrónico válido."); return; }
                  setErrorMsg(null);
                  setConfirmado(true);
                }}
                disabled={!email.trim() || ventanaCancelacionVencida}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold transition"
              >
                Cancelar mi cita
              </button>
            </>
          ) : (
            <>
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                ¿Confirmas que deseas cancelar esta cita? Esta acción no se puede deshacer.
              </div>
              {errorMsg && (
                <p role="alert" className="text-xs text-red-700">{errorMsg}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirmado(false); setErrorMsg(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-slate-50 transition"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleCancelar}
                  disabled={isPending}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold transition"
                >
                  {isPending ? "Cancelando..." : "Sí, cancelar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
