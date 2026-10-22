import { empleadosApi } from "../api/empleados";
import { serviciosApi } from "../api/servicios";
import { hoy } from "../utils/fechas";

// ── Citas futuras de un empleado o servicio (decisión 7, OM-17) ───────────────
//
// Antes de borrar o desactivar un empleado o un servicio se cuentan sus citas
// abiertas (Pendiente o Confirmada) desde hoy, en la zona del negocio. El
// servidor las cuenta (B13: `GET /empleados/{id}/citas-futuras` y
// `GET /servicios/{id}/citas-futuras`) y además rechaza el borrado con 409 si
// las hay, así que el conteo siempre es completo.

export interface ConteoCitasFuturas {
  total: number;
  /**
   * `false` si el conteo puede quedarse corto. Con el endpoint del servidor es
   * siempre `true`; se conserva para que quien lo use siga fallando cerrado.
   */
  completo: boolean;
}

export async function contarCitasFuturas(
  filtro: { empleadoId: string } | { servicioId: string },
): Promise<ConteoCitasFuturas> {
  const total = "empleadoId" in filtro
    ? await empleadosApi.contarCitasFuturas(filtro.empleadoId)
    : await serviciosApi.contarCitasFuturas(filtro.servicioId);
  return { total, completo: true };
}

/** Enlace a Citas desde hoy, sin fecha final, opcionalmente por empleado. */
export function enlaceCitasFuturas(empleadoId?: string): string {
  const params = new URLSearchParams({ desde: hoy(), hasta: "" });
  if (empleadoId) params.set("empleadoId", empleadoId);
  return `/dashboard/citas?${params.toString()}`;
}
