import { useState, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToastStore } from "../store/toastStore";
import { mensajeError } from "../utils/errores";
import { validarImagen, type OnProgreso } from "../lib/imagenes";

interface Opciones<T> {
  /** Sube el archivo; `destino` identifica a quién pertenece (id del empleado, del servicio…). */
  subir: (archivo: File, destino: string | undefined, onProgreso: OnProgreso) => Promise<T>;
  onExito?: (resultado: T, destino: string | undefined) => void;
  /** Texto si el servidor no explica el fallo. */
  mensajeFallo: string;
}

/**
 * Subida de una imagen con la misma regla en toda la app: valida tipo y tamaño
 * antes de subir, informa el avance, limpia el `<input>` (para poder volver a
 * elegir el mismo archivo tras un fallo) y muestra el error del servidor.
 */
export function useSubirImagen<T>({ subir, onExito, mensajeFallo }: Opciones<T>) {
  const { toast } = useToastStore();
  const [progreso, setProgreso] = useState<number | null>(null);
  const [destino, setDestino] = useState<string | undefined>(undefined);

  const mutacion = useMutation({
    mutationFn: ({ archivo, destino: d }: { archivo: File; destino?: string }) =>
      subir(archivo, d, setProgreso),
    onSuccess: (resultado, { destino: d }) => onExito?.(resultado, d),
    onError: (err) => toast(mensajeError(err, mensajeFallo), "error"),
    onSettled: () => { setProgreso(null); setDestino(undefined); },
  });

  /** Valida y sube. Devuelve `false` si el archivo se rechazó sin subirlo. */
  const subirArchivo = (archivo: File, d?: string): boolean => {
    const error = validarImagen(archivo);
    if (error) {
      toast(error, "error");
      return false;
    }
    setDestino(d);
    setProgreso(0);
    mutacion.mutate({ archivo, destino: d });
    return true;
  };

  /** Para el `onChange` de un `<input type="file">`. */
  const alElegir = (e: ChangeEvent<HTMLInputElement>, d?: string) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo) subirArchivo(archivo, d);
  };

  return {
    subirArchivo,
    alElegir,
    subiendo: mutacion.isPending,
    /** 0–100 mientras sube; `null` si no hay subida. */
    progreso,
    /** A quién pertenece la subida en curso. */
    destino: mutacion.isPending ? destino : undefined,
  };
}
