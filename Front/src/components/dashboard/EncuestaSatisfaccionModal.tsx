import { useState } from "react";
import { Star } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { encuestaApi } from "../../api/encuesta";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface Props {
  onCerrar: () => void;
}

export function EncuestaSatisfaccionModal({ onCerrar }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const qc = useQueryClient();

  const invalidar = () => qc.invalidateQueries({ queryKey: ["encuesta-estado"] });

  const responder = useMutation({
    mutationFn: () => encuestaApi.responder({ rating, comentario: comentario.trim() || undefined }),
    onSuccess: () => {
      setEnviado(true);
      invalidar();
      setTimeout(onCerrar, 2000);
    },
  });

  const posponer = useMutation({
    mutationFn: encuestaApi.posponer,
    onSuccess: () => { invalidar(); onCerrar(); },
  });

  const rechazar = useMutation({
    mutationFn: encuestaApi.rechazar,
    onSuccess: () => { invalidar(); onCerrar(); },
  });

  const labels = ["Muy mala", "Mala", "Regular", "Buena", "Excelente"];

  return (
    <Dialog open onOpenChange={() => posponer.mutate()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
            ¿Cómo ha sido tu experiencia?
          </DialogTitle>
        </DialogHeader>

        {enviado ? (
          <div className="py-8 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
              ¡Gracias por tu valoración!
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Tu opinión nos ayuda a mejorar AppointVa.
            </p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nos toma menos de un minuto. Tu opinión es muy importante para nosotros.
            </p>

            {/* Star rating */}
            <div className="space-y-2">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                    aria-label={`${n} estrellas`}
                  >
                    <Star
                      size={32}
                      className={
                        n <= (hover || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-slate-100 text-slate-300 dark:fill-slate-700 dark:text-slate-600"
                      }
                    />
                  </button>
                ))}
              </div>
              {(hover || rating) > 0 && (
                <p className="text-center text-xs text-amber-600 font-medium">
                  {labels[(hover || rating) - 1]}
                </p>
              )}
            </div>

            {/* Optional comment */}
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Cuéntanos más (opcional)..."
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={rating === 0 || responder.isPending}
                onClick={() => responder.mutate()}
                className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition"
              >
                {responder.isPending ? "Enviando..." : "Enviar valoración"}
              </button>

              <div className="flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => posponer.mutate()}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  Más tarde
                </button>
                <span className="text-slate-200 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => rechazar.mutate()}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  No, gracias
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
