import { useCallback, useEffect, useRef, useState } from "react";
import FormReautenticacion from "./FormReautenticacion";
import {
  ReautenticacionCancelada,
  esReautenticacionRequerida,
  olvidarPrueba,
  pruebaVigente,
} from "../../../lib/pruebaReautenticacion";

/**
 * Pide "Confirma que eres tú" solo cuando hace falta (lote 5, G1).
 *
 * `conReautenticacion(accion)` usa la prueba vigente si la hay; si no, muestra
 * `formulario` (el modal que lo usa lo pinta en lugar de su contenido) y espera.
 * Si el servidor responde que la prueba ya no vale (venció, cambió la
 * contraseña), la olvida y la pide una vez más. Cancelar rechaza con
 * `ReautenticacionCancelada`, que quien llama ignora (`esCancelacion`).
 */
export function useReautenticacion(accion: string) {
  const [pidiendo, setPidiendo] = useState(false);
  const pendiente = useRef<{ resolve: (prueba: string) => void; reject: (err: unknown) => void } | null>(null);

  // Si el modal se desmonta a media espera, la promesa no queda colgada.
  useEffect(() => () => pendiente.current?.reject(new ReautenticacionCancelada()), []);

  const pedirPrueba = useCallback((): Promise<string> => {
    const vigente = pruebaVigente();
    if (vigente) return Promise.resolve(vigente);
    setPidiendo(true);
    return new Promise<string>((resolve, reject) => {
      pendiente.current = { resolve, reject };
    });
  }, []);

  const conReautenticacion = useCallback(
    async <T,>(ejecutar: (prueba: string) => Promise<T>): Promise<T> => {
      const prueba = await pedirPrueba();
      try {
        return await ejecutar(prueba);
      } catch (err) {
        if (!esReautenticacionRequerida(err)) throw err;
        olvidarPrueba();
        return ejecutar(await pedirPrueba());
      }
    },
    [pedirPrueba],
  );

  const terminar = (resultado: { prueba: string } | { cancelado: true }) => {
    const p = pendiente.current;
    pendiente.current = null;
    setPidiendo(false);
    if ("prueba" in resultado) p?.resolve(resultado.prueba);
    else p?.reject(new ReautenticacionCancelada());
  };

  const formulario = pidiendo ? (
    <FormReautenticacion
      accion={accion}
      onConfirmado={(prueba) => terminar({ prueba })}
      onCancelar={() => terminar({ cancelado: true })}
    />
  ) : null;

  return { pidiendo, conReautenticacion, formulario };
}
