import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../api/axios";

interface CitaResumen {
  codigoConfirmacion: string;
  nombreNegocio: string;
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
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }) + " · " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

function formatPrecio(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export default function CancelarCitaPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [email, setEmail] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [cancelada, setCancelada] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: cita, isLoading, isError } = useQuery<CitaResumen>({
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
    onError: (err: any) => {
      const msg = err?.response?.data?.mensaje ?? "No se pudo cancelar la cita. Verifica tu correo e intenta de nuevo.";
      setErrorMsg(msg);
    },
  });

  const handleCancelar = () => {
    setErrorMsg(null);
    cancelar();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    );
  }

  if (isError || !cita) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Cita no encontrada</p>
          <p className="text-sm text-gray-400">El enlace puede haber expirado o no es válido.</p>
        </div>
      </div>
    );
  }

  if (cancelada) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Cita cancelada</p>
          <p className="text-sm text-gray-500">Tu cita ha sido cancelada exitosamente. Recibirás un correo de confirmación.</p>
        </div>
      </div>
    );
  }

  if (cita.estado === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <p className="font-semibold text-gray-700 mb-1">Esta cita ya está cancelada</p>
          <p className="text-sm text-gray-400">No es necesario hacer nada más.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-sm overflow-hidden">
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
                <span className="font-medium text-gray-800 text-right capitalize">{formatFechaHora(cita.inicioEn)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Precio</span>
                <span className="font-medium text-gray-800">{formatPrecio(cita.precio)}</span>
              </div>
            </div>
          </div>

          {cita.horasCancelacion > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-700">
              Esta cita solo puede cancelarse con al menos {cita.horasCancelacion} hora{cita.horasCancelacion === 1 ? "" : "s"} de anticipación.
            </div>
          )}

          {!confirmado ? (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">
                  Confirma tu correo electrónico para cancelar
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-slate-700"
                />
              </div>
              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}
              <button
                onClick={() => { setErrorMsg(null); setConfirmado(true); }}
                disabled={!email.trim()}
                className="w-full py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold transition"
              >
                Cancelar mi cita
              </button>
            </>
          ) : (
            <>
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                ¿Confirmas que deseas cancelar esta cita? Esta acción no se puede deshacer.
              </div>
              {errorMsg && (
                <p className="text-xs text-red-500">{errorMsg}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirmado(false); setErrorMsg(null); }}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Volver
                </button>
                <button
                  onClick={handleCancelar}
                  disabled={isPending}
                  className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold transition"
                >
                  {isPending ? "Cancelando..." : "Sí, cancelar"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
