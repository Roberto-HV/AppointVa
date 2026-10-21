import { useRef, useState, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToastStore } from "../store/toastStore";
import { mensajeError } from "../utils/errores";
import { validarImagen, type OnProgreso, type PorcentajeSubida } from "../lib/imagenes";

interface Opciones<T> {
  /** Sube el archivo; `destino` identifica a quién pertenece (id del empleado, del servicio…). */
  subir: (archivo: File, destino: string | undefined, onProgreso: OnProgreso) => Promise<T>;
  onExito?: (resultado: T, destino: string | undefined) => void;
  /** Texto si el servidor no explica el fallo. */
  mensajeFallo: string;
}

/** Clave interna de una subida; una subida sin destino usa la cadena vacía. */
const clave = (destino: string | undefined) => destino ?? "";

/**
 * Subida de una imagen con la misma regla en toda la app: valida tipo y tamaño
 * antes de subir, informa el avance, limpia el `<input>` (para poder volver a
 * elegir el mismo archivo tras un fallo) y muestra el error del servidor.
 *
 * Varias subidas pueden ir a la vez (una por fila en Empleados o Servicios):
 * el avance se guarda por destino, así que terminar una no borra el estado de
 * otra. Una segunda subida al mismo destino mientras la primera sigue en curso
 * se ignora.
 */
export function useSubirImagen<T>({ subir, onExito, mensajeFallo }: Opciones<T>) {
  const { toast } = useToastStore();
  // destino → avance (null = sin total conocido). Ausente = no se sube nada ahí.
  const [enCurso, setEnCurso] = useState<Record<string, PorcentajeSubida>>({});
  // Copia síncrona de los destinos en curso: dos clics en el mismo render no
  // deben pasar los dos el control de duplicados.
  const destinosEnCurso = useRef(new Set<string>());

  const quitar = (d: string | undefined) => {
    destinosEnCurso.current.delete(clave(d));
    setEnCurso((actual) => {
      const resto = { ...actual };
      delete resto[clave(d)];
      return resto;
    });
  };

  // Los callbacks de `useMutation` se ejecutan para cada llamada a `mutate`,
  // no solo para la última, así que cada subida limpia su propio destino.
  const mutacion = useMutation({
    mutationFn: ({ archivo, destino: d }: { archivo: File; destino?: string }) =>
      subir(archivo, d, (porcentaje) =>
        setEnCurso((actual) => (clave(d) in actual ? { ...actual, [clave(d)]: porcentaje } : actual))),
    onSuccess: (resultado, { destino: d }) => onExito?.(resultado, d),
    onError: (err) => toast(mensajeError(err, mensajeFallo), "error"),
    onSettled: (_r, _e, { destino: d }) => quitar(d),
  });

  /** Valida y sube. Devuelve `false` si el archivo se rechazó o ya hay una subida a ese destino. */
  const subirArchivo = (archivo: File, d?: string): boolean => {
    if (destinosEnCurso.current.has(clave(d))) return false;
    const error = validarImagen(archivo);
    if (error) {
      toast(error, "error");
      return false;
    }
    // Hasta el primer evento de avance no se sabe el total: indeterminado.
    destinosEnCurso.current.add(clave(d));
    setEnCurso((actual) => ({ ...actual, [clave(d)]: null }));
    mutacion.mutate({ archivo, destino: d });
    return true;
  };

  /** Para el `onChange` de un `<input type="file">`. */
  const alElegir = (e: ChangeEvent<HTMLInputElement>, d?: string) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (archivo) subirArchivo(archivo, d);
  };

  /** Si hay una subida en curso a ese destino (sin destino: la subida única). */
  const subiendoEn = (d?: string) => clave(d) in enCurso;

  /** Avance de la subida a ese destino; `undefined` si no hay ninguna. */
  const progresoDe = (d?: string): PorcentajeSubida | undefined => enCurso[clave(d)];

  return {
    subirArchivo,
    alElegir,
    subiendoEn,
    progresoDe,
    /** Hay al menos una subida en curso. */
    subiendo: Object.keys(enCurso).length > 0,
    /** Avance de la subida sin destino (logo, portada…); `undefined` si no hay. */
    progreso: progresoDe(undefined),
  };
}
