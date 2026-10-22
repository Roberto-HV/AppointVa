import { citasApi, ESTADOS } from "../api/citas";
import { hoy } from "../utils/fechas";

// ── Citas futuras de un empleado o servicio (decisión 7, OM-17) ───────────────
//
// Antes de borrar un empleado o un servicio se cuentan sus citas abiertas
// (Pendiente o Confirmada) desde hoy. No hay endpoint de conteo (B13): se usa la
// lista de citas con `estado`. Para empleados basta el `total` de una página de
// 1; la lista no filtra por servicio, así que para servicios se pide una página
// grande y se filtra aquí (`completo: false` si había más de las que llegaron).

const TAMANO_SERVICIO = 500;

export interface ConteoCitasFuturas {
  total: number;
  /**
   * `false` si el conteo puede quedarse corto (solo servicios con muchas citas).
   * Quien lo use debe fallar cerrado: con `completo: false` no se permite borrar.
   */
  completo: boolean;
}

export async function contarCitasFuturas(
  filtro: { empleadoId: string } | { servicioId: string },
): Promise<ConteoCitasFuturas> {
  const desde = hoy();
  const estados = [ESTADOS.Pendiente, ESTADOS.Confirmada];
  if ("empleadoId" in filtro) {
    const paginas = await Promise.all(
      estados.map((estado) => citasApi.obtenerTodas({ desde, empleadoId: filtro.empleadoId, estado, pagina: 1, tamano: 1 })),
    );
    return { total: paginas.reduce((s, p) => s + p.total, 0), completo: true };
  }
  const paginas = await Promise.all(
    estados.map((estado) => citasApi.obtenerTodas({ desde, estado, pagina: 1, tamano: TAMANO_SERVICIO })),
  );
  return {
    total: paginas.reduce((s, p) => s + p.datos.filter((c) => c.servicioId === filtro.servicioId).length, 0),
    completo: paginas.every((p) => p.datos.length >= p.total),
  };
}

/** Enlace a Citas desde hoy, sin fecha final, opcionalmente por empleado. */
export function enlaceCitasFuturas(empleadoId?: string): string {
  const params = new URLSearchParams({ desde: hoy(), hasta: "" });
  if (empleadoId) params.set("empleadoId", empleadoId);
  return `/dashboard/citas?${params.toString()}`;
}
