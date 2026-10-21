import { useEffect, useState } from "react";
import { verificarSlug } from "../api/auth";

export type EstadoSlug = "idle" | "checking" | "available" | "taken";

/** Un slug que vale la pena consultar: 2+ caracteres en minúsculas, dígitos o guiones. */
export function slugConsultable(slug: string): boolean {
  return slug.length >= 2 && /^[a-z0-9-]+$/.test(slug);
}

/**
 * Disponibilidad de un slug con espera de `retardo` ms, la misma comprobación
 * para el registro público y para "Nuevo negocio" del admin (AP-23). Las
 * respuestas de un slug que ya cambió se descartan. Si la consulta falla, el
 * estado vuelve a `idle` y el servidor tiene la última palabra al guardar.
 */
export function useDisponibilidadSlug(slug: string | undefined, retardo = 500): EstadoSlug {
  const valor = slug?.trim() ?? "";
  const consultable = slugConsultable(valor);
  const [resultado, setResultado] = useState<{ slug: string; estado: EstadoSlug } | null>(null);

  useEffect(() => {
    if (!consultable) return;
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const { disponible } = await verificarSlug(valor);
        if (vigente) setResultado({ slug: valor, estado: disponible ? "available" : "taken" });
      } catch {
        if (vigente) setResultado({ slug: valor, estado: "idle" });
      }
    }, retardo);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [valor, consultable, retardo]);

  if (!consultable) return "idle";
  return resultado?.slug === valor ? resultado.estado : "checking";
}
