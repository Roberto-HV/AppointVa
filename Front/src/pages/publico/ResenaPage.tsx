import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { publicoApi } from "../../api/publico";
import { Star } from "lucide-react";

export default function ResenaPage() {
  const { token } = useParams<{ token: string }>();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);

  const { data: info, isLoading, isError, error } = useQuery({
    queryKey: ["resena-token", token],
    queryFn: () => publicoApi.obtenerTokenResena(token!),
    retry: false,
    enabled: !!token,
  });

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => publicoApi.enviarResena(token!, { rating, comentario: comentario.trim() || undefined }),
    onSuccess: () => setEnviado(true),
  });

  const errorMsg = (error as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-4xl mb-4">😔</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-sm text-gray-500">{errorMsg ?? "Este enlace ha expirado o ya fue utilizado."}</p>
        </div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
          <div className="text-5xl mb-4">⭐</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">¡Gracias por tu reseña!</h1>
          <p className="text-sm text-gray-500">Tu opinión ayuda a <strong>{info?.negocioNombre}</strong> a seguir mejorando.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-sm w-full shadow-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{info?.negocioNombre}</h1>
          {info?.servicio && (
            <p className="text-sm text-gray-500 mt-1">
              {info.servicio}
              {info.empleado ? ` · con ${info.empleado}` : ""}
            </p>
          )}
          <p className="text-sm text-gray-400 mt-3">¿Cómo calificarías tu experiencia?</p>
        </div>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={36}
                className="transition-colors"
                fill={(hover || rating) >= star ? "#C8A961" : "none"}
                stroke={(hover || rating) >= star ? "#C8A961" : "#d1d5db"}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-sm font-medium text-gray-600 mb-4">
            {["", "Muy malo", "Malo", "Regular", "Bueno", "¡Excelente!"][rating]}
          </p>
        )}

        {/* Comentario */}
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Cuéntanos más sobre tu experiencia (opcional)"
          maxLength={1000}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary resize-none mb-4"
        />

        <button
          onClick={() => enviar()}
          disabled={rating === 0 || isPending}
          className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold text-sm transition"
        >
          {isPending ? "Enviando..." : "Enviar reseña"}
        </button>
      </div>
    </div>
  );
}
