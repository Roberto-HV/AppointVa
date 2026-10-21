import { useState } from "react";
import { AlertCircle, Star } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import PublicFooter from "../../components/PublicFooter";
import EstrellasCalificacion from "../../components/EstrellasCalificacion";
import { ETIQUETAS_CALIFICACION } from "../../lib/calificacion";
import { mensajeError } from "../../utils/errores";
import { useTituloPagina } from "../../hooks/useTituloPagina";

const MAX_COMENTARIO = 1000;

export default function ResenaPage() {
  const { token } = useParams<{ token: string }>();
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const { data: info, isLoading, isError, error } = useQuery({
    queryKey: ["resena-token", token],
    queryFn: () => publicoApi.obtenerTokenResena(token!),
    retry: false,
    enabled: !!token,
  });

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => publicoApi.enviarResena(token!, { rating, comentario: comentario.trim() || undefined }),
    onSuccess: () => setEnviado(true),
    onError: (err) => setErrorEnvio(mensajeError(err, "No se pudo enviar tu reseña. Intenta de nuevo.")),
  });

  const errorMsg = (error as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;

  // Solo el título de la pestaña (AP-17). Las etiquetas og:* que se escribían
  // aquí no las leen los rastreadores (no ejecutan JS) y quedaban en el <head>.
  useTituloPagina(info ? `Califica tu cita en ${info.negocioNombre}` : "Califica tu cita");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center shadow-sm">
          <AlertCircle size={40} className="mx-auto mb-4 text-slate-400" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-sm text-gray-500">{errorMsg ?? "Este enlace ha expirado o ya fue utilizado."}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full text-center shadow-sm">
          <Star size={44} className="mx-auto mb-4 text-rating fill-rating" aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">¡Gracias por tu reseña!</h1>
          <p className="text-sm text-gray-500">Tu opinión ayuda a <strong>{info?.negocioNombre}</strong> a seguir mejorando.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl border border-slate-100 p-8 max-w-sm w-full shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{info?.negocioNombre}</h1>
          {info?.servicio && (
            <p className="text-sm text-gray-500 mt-1">
              {info.servicio}
              {info.empleado ? ` · con ${info.empleado}` : ""}
            </p>
          )}
          <p id="pregunta-calificacion" className="text-sm text-gray-500 mt-3">¿Cómo calificarías tu experiencia?</p>
        </div>

        {/* Stars */}
        <div className="mb-4">
          <EstrellasCalificacion valor={rating} onCambiar={setRating} etiquetadoPor="pregunta-calificacion" />
        </div>

        <p className="text-center text-sm font-medium text-gray-600 mb-4 min-h-[1.25rem]" aria-hidden="true">
          {rating > 0 ? ETIQUETAS_CALIFICACION[rating - 1] : ""}
        </p>

        {/* Comentario */}
        <label htmlFor="comentario-resena" className="block text-sm font-medium text-gray-700 mb-1">
          Comentario <span className="font-normal text-gray-500">(opcional)</span>
        </label>
        <textarea
          id="comentario-resena"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Cuéntanos más sobre tu experiencia"
          maxLength={MAX_COMENTARIO}
          rows={3}
          aria-describedby="contador-comentario"
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-slate-700 resize-none"
        />
        <p id="contador-comentario" className="text-right text-xs text-gray-500 mt-1 mb-4">
          {comentario.length}/{MAX_COMENTARIO}
        </p>

        {errorEnvio && (
          <p role="alert" className="text-red-600 text-sm text-center mb-2">{errorEnvio}</p>
        )}
        <button
          onClick={() => { setErrorEnvio(null); enviar(); }}
          disabled={rating === 0 || isPending}
          className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold text-sm transition"
        >
          {isPending ? "Enviando..." : "Enviar reseña"}
        </button>
      </div>
      <PublicFooter />
    </div>
  );
}
