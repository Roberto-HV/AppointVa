import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { negociosApi } from "../../api/negocios";
import { useToastStore } from "../../store/toastStore";
import { Upload, Trash2, X, ImageIcon } from "lucide-react";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import { mensajeError } from "../../utils/errores";

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
    onError: (err: unknown) => toast(mensajeError(err, "No se pudo subir la imagen"), "error"),
  });

  const { mutate: eliminar, isPending: eliminandoFoto } = useMutation({
    mutationFn: (id: string) => negociosApi.eliminarImagenGaleria(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["galeria"] });
      setEliminando(null);
      toast("Foto eliminada");
    },
    onError: () => toast("No se pudo eliminar la foto. Intenta de nuevo.", "error"),
  });

  const MAX_MB = 10;
  const handleArchivos = (files: FileList | null) => {
    if (!files) return;
    const restantes = MAX_FOTOS - imagenes.length;
    Array.from(files).slice(0, restantes).forEach((f) => {
      if (!f.type.startsWith("image/")) {
        toast(`"${f.name}" no es una imagen válida`, "error");
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast(`"${f.name}" supera el límite de ${MAX_MB} MB`, "error");
        return;
      }
      subir(f);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleArchivos(e.dataTransfer.files);
  };

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo="Galería"
        subtitulo={
          <>
            Fotos de tus trabajos visibles en tu página de reservas
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">({imagenes.length}/{MAX_FOTOS})</span>
          </>
        }
        acciones={
          imagenes.length < MAX_FOTOS && (
            <BotonAccion onClick={() => inputRef.current?.click()} disabled={subiendo}>
              <Upload size={15} />
              {subiendo ? "Subiendo..." : "Agregar fotos"}
            </BotonAccion>
          )
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleArchivos(e.target.files); e.target.value = ""; }}
      />

      {/* Drop zone (solo cuando no hay fotos) */}
      {!isLoading && imagenes.length === 0 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-2xl p-16 flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500 hover:border-gray-300 hover:text-gray-500 dark:hover:text-gray-400 cursor-pointer transition"
        >
          <ImageIcon size={40} strokeWidth={1.2} />
          <p className="text-sm font-medium">Arrastra fotos aquí o haz clic para seleccionar</p>
          <p className="text-xs">JPG, PNG o WebP · Máximo {MAX_FOTOS} fotos</p>
        </div>
      )}

      {/* Grid de fotos */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-gray-100 dark:bg-slate-700 animate-pulse" />
          ))}
        </div>
      ) : imagenes.length > 0 && (
        <>
          <div
            // Más columnas al ensanchar: el grid ya no está acotado a 4xl, y con
            // cuatro columnas fijas cada miniatura pasaría de 350px de lado.
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {imagenes.map((img, i) => (
              <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-700">
                <button
                  type="button"
                  onClick={() => setLightbox(img.url)}
                  aria-label={`Ver foto ${i + 1} ampliada`}
                  className="block w-full h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <img
                    src={img.url}
                    alt={img.descripcion ?? ""}
                    className="w-full h-full object-cover transition group-hover:brightness-90"
                  />
                </button>
                {/* Eliminar: siempre visible donde no hay hover (táctil) y al
                    enfocar con el teclado; con ratón aparece al pasar por encima. */}
                <button
                  type="button"
                  onClick={() => setEliminando(img.id)}
                  aria-label={`Eliminar foto ${i + 1}`}
                  title="Eliminar"
                  className="absolute top-1.5 right-1.5 w-9 h-9 rounded-full bg-black/60 hover:bg-red-700 text-white flex items-center justify-center transition
                    opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))}

            {/* Celda de agregar más */}
            {imagenes.length < MAX_FOTOS && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={subiendo}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 hover:border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 transition disabled:opacity-40"
              >
                <Upload size={22} strokeWidth={1.5} />
                <span className="text-xs font-medium">Agregar</span>
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
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
            type="button"
            aria-label="Cerrar foto ampliada"
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

      {/* Confirmar eliminar: diálogo accesible (foco atrapado, Escape). */}
      <ConfirmarAccion
        abierto={!!eliminando}
        titulo="¿Eliminar foto?"
        mensaje="La foto deja de mostrarse en tu página de reservas. Esta acción no se puede deshacer."
        etiquetaConfirmar="Eliminar foto"
        destructiva
        pendiente={eliminandoFoto}
        onConfirmar={() => eliminando && eliminar(eliminando)}
        onCerrar={() => setEliminando(null)}
      />
    </div>
  );
}
