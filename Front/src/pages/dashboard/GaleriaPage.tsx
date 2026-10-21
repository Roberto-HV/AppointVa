import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { negociosApi } from "../../api/negocios";
import { useToastStore } from "../../store/toastStore";
import { Upload, Trash2, X, ImageIcon } from "lucide-react";
import BotonAccion from "../../components/ui/BotonAccion";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import ConfirmarAccion from "../../components/ui/ConfirmarAccion";
import ProgresoSubida from "../../components/ui/ProgresoSubida";
import ErrorCarga from "../../components/ui/ErrorCarga";
import { mensajeError } from "../../utils/errores";
import { ACCEPT_IMAGEN, TEXTO_FORMATOS_IMAGEN, validarImagen } from "../../lib/imagenes";

const MAX_FOTOS = 20;

/** Una subida en curso: se pinta como una miniatura con su avance. */
interface Subida {
  id: string;
  nombre: string;
  /** `null` mientras no se conoce el total (barra indeterminada). */
  progreso: number | null;
}

/** Cuántas fotos de una selección entran sin pasar el límite, y cuántas sobran. */
function repartirPorLimite<T>(archivos: T[], ocupadas: number, maximo = MAX_FOTOS) {
  const libres = Math.max(0, maximo - ocupadas);
  return { aceptados: archivos.slice(0, libres), descartados: Math.max(0, archivos.length - libres) };
}

export default function GaleriaPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const { data: imagenes = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["galeria"],
    queryFn: negociosApi.obtenerGaleria,
  });

  // Una entrada por archivo: cada uno muestra su propio avance, y "Subiendo…"
  // dura hasta que termina el último, no el primero.
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const subiendo = subidas.length > 0;

  const subir = async (archivo: File) => {
    const id = crypto.randomUUID();
    setSubidas((s) => [...s, { id, nombre: archivo.name, progreso: null }]);
    try {
      await negociosApi.subirImagenGaleria(archivo, undefined, (progreso) =>
        setSubidas((s) => s.map((x) => (x.id === id ? { ...x, progreso } : x))));
      await qc.invalidateQueries({ queryKey: ["galeria"] });
      toast(`"${archivo.name}" se agregó a la galería`);
    } catch (err) {
      toast(mensajeError(err, `No se pudo subir "${archivo.name}". Intenta de nuevo.`), "error");
    } finally {
      setSubidas((s) => s.filter((x) => x.id !== id));
    }
  };

  const { mutate: eliminar, isPending: eliminandoFoto } = useMutation({
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
    const validos: File[] = [];
    for (const f of Array.from(files)) {
      const error = validarImagen(f);
      if (error) toast(error, "error");
      else validos.push(f);
    }
    // Las que no caben se cuentan en voz alta: antes se descartaban en silencio.
    const { aceptados, descartados } = repartirPorLimite(validos, imagenes.length + subidas.length);
    if (descartados > 0) {
      toast(
        `${descartados} ${descartados === 1 ? "foto no se agregó" : "fotos no se agregaron"}: el límite es de ${MAX_FOTOS} fotos.`,
        "error",
      );
    }
    aceptados.forEach((f) => { void subir(f); });
  };

  const zonaArrastre = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); setArrastrando(true); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setArrastrando(true); },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setArrastrando(false);
      handleArchivos(e.dataTransfer.files);
    },
  };
  const lleno = imagenes.length + subidas.length >= MAX_FOTOS;

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo="Galería"
        subtitulo={
          <>
            Fotos de tus trabajos visibles en tu página de reservas
            <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">({imagenes.length}/{MAX_FOTOS})</span>
          </>
        }
        acciones={
          !lleno && (
            <BotonAccion onClick={() => inputRef.current?.click()}>
              <Upload size={15} />
              {subiendo ? `Subiendo ${subidas.length}…` : "Agregar fotos"}
            </BotonAccion>
          )
        }
      />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_IMAGEN}
        multiple
        className="hidden"
        onChange={(e) => { handleArchivos(e.target.files); e.target.value = ""; }}
      />

      {/* Drop zone (solo cuando no hay fotos ni subidas) */}
      {!isLoading && !isError && imagenes.length === 0 && subidas.length === 0 && (
        <button
          type="button"
          {...zonaArrastre}
          onClick={() => inputRef.current?.click()}
          data-arrastrando={arrastrando || undefined}
          className={`w-full border-2 border-dashed rounded-2xl p-16 flex flex-col items-center gap-3 cursor-pointer transition
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              arrastrando
                ? "border-primary bg-muted text-foreground"
                : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
        >
          <ImageIcon size={40} strokeWidth={1.2} aria-hidden="true" />
          <span className="text-sm font-medium">
            {arrastrando ? "Suelta las fotos para subirlas" : "Arrastra fotos aquí o haz clic para seleccionar"}
          </span>
          <span className="text-xs">{`${TEXTO_FORMATOS_IMAGEN} · Máximo ${MAX_FOTOS} fotos`}</span>
        </button>
      )}

      {/* Grid de fotos */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ErrorCarga mensaje="No se pudo cargar la galería." onReintentar={() => refetch()} reintentando={isFetching} />
      ) : (imagenes.length > 0 || subidas.length > 0) && (
        <>
          <div
            // Más columnas al ensanchar: el grid ya no está acotado a 4xl, y con
            // cuatro columnas fijas cada miniatura pasaría de 350px de lado.
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 rounded-xl transition ${
              arrastrando ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : ""
            }`}
            {...zonaArrastre}
          >
            {imagenes.map((img, i) => (
              <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
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

            {/* Una miniatura por subida en curso, con su propio avance. */}
            {subidas.map((s) => (
              <div
                key={s.id}
                className="aspect-square rounded-xl bg-muted border border-border flex flex-col items-center justify-center gap-2 p-3 text-center"
              >
                <Upload size={20} className="text-muted-foreground" aria-hidden="true" />
                <span className="text-xs text-foreground truncate max-w-full" title={s.nombre}>{s.nombre}</span>
                <ProgresoSubida porcentaje={s.progreso} etiqueta={`Subiendo ${s.nombre}`} />
              </div>
            ))}

            {/* Celda de agregar más */}
            {!lleno && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Upload size={22} strokeWidth={1.5} aria-hidden="true" />
                <span className="text-xs font-medium">Agregar</span>
              </button>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            {`Arrastra imágenes al grid para agregar más · ${TEXTO_FORMATOS_IMAGEN} · Las fotos se muestran en tu página de reservas en el mismo orden.`}
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
