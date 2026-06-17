import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { negociosApi } from "../../api/negocios";
import { useToastStore } from "../../store/toastStore";
import { Upload, Trash2, X, ImageIcon } from "lucide-react";

const MAX_FOTOS = 20;

export default function GaleriaPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const { data: imagenes = [], isLoading } = useQuery({
    queryKey: ["galeria"],
    queryFn: negociosApi.obtenerGaleria,
  });

  const { mutate: subir, isPending: subiendo } = useMutation({
    mutationFn: (archivo: File) => negociosApi.subirImagenGaleria(archivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["galeria"] });
      toast("Foto agregada a la galería");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje;
      toast(msg ?? "No se pudo subir la imagen");
    },
  });

  const { mutate: eliminar } = useMutation({
    mutationFn: (id: string) => negociosApi.eliminarImagenGaleria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["galeria"] });
      setEliminando(null);
      toast("Foto eliminada");
    },
    onError: () => toast("No se pudo eliminar la foto. Intenta de nuevo.", "error"),
  });

  const handleArchivos = (files: FileList | null) => {
    if (!files) return;
    const restantes = MAX_FOTOS - imagenes.length;
    Array.from(files).slice(0, restantes).forEach((f) => subir(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleArchivos(e.dataTransfer.files);
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Galería</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Fotos de tus trabajos visibles en tu página de reservas
            <span className="ml-2 text-xs text-gray-400">({imagenes.length}/{MAX_FOTOS})</span>
          </p>
        </div>
        {imagenes.length < MAX_FOTOS && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition"
          >
            <Upload size={15} />
            {subiendo ? "Subiendo..." : "Agregar fotos"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleArchivos(e.target.files)}
        />
      </div>

      {/* Drop zone (solo cuando no hay fotos) */}
      {!isLoading && imagenes.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center gap-3 text-gray-400 hover:border-gray-300 hover:text-gray-500 cursor-pointer transition"
        >
          <ImageIcon size={40} strokeWidth={1.2} />
          <p className="text-sm font-medium">Arrastra fotos aquí o haz clic para seleccionar</p>
          <p className="text-xs">JPG, PNG o WebP · Máximo {MAX_FOTOS} fotos</p>
        </div>
      )}

      {/* Grid de fotos */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : imagenes.length > 0 && (
        <>
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {imagenes.map((img) => (
              <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={img.url}
                  alt={img.descripcion ?? ""}
                  className="w-full h-full object-cover cursor-pointer transition group-hover:brightness-90"
                  onClick={() => setLightbox(img.url)}
                />
                {/* Botón eliminar */}
                <button
                  onClick={() => setEliminando(img.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {/* Celda de agregar más */}
            {imagenes.length < MAX_FOTOS && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-gray-500 transition disabled:opacity-40"
              >
                <Upload size={22} strokeWidth={1.5} />
                <span className="text-xs font-medium">Agregar</span>
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Arrastra imágenes al grid para agregar más · Las fotos se muestran en tu página de reservas en el mismo orden.
          </p>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-[88vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirmar eliminar */}
      {eliminando && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-1">¿Eliminar foto?</h3>
            <p className="text-sm text-gray-500 mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setEliminando(null)}
                className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminar(eliminando)}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
