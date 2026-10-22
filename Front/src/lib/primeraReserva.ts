import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { citasApi } from "../api/citas";
import type { CitaDto, PuntoDatos, ResumenDashboard } from "../types";

// ── Primera reserva: una tarjeta, una sola vez por negocio ───────────────────
//
// El API no dice cuál fue "la primera reserva", así que se deduce y solo
// cuando no hay duda.
//
// Señal histórica elegida: el total de citas de toda la vida del negocio, que
// ya expone `GET /citas` sin filtro de fechas en la cabecera `X-Total-Count`
// (`citasApi.obtenerTodas({ tamano: 1 })`, el mismo endpoint que usa la
// agenda). El perfil del negocio no trae fecha de creación y el resumen solo
// cubre hoy/semana/mes, así que un negocio con citas antiguas pero ninguna
// reciente se veía igual que uno nuevo; con el total histórico eso ya no pasa.
// La consulta solo se hace mientras la marca no es "vista" (en la práctica,
// una vez por negocio establecido).
//
//   1. Total histórico 0 y el panel sin ninguna cita: queda "sin-reservas".
//   2. Estando así, cuando el total pasa a exactamente 1 y esa única cita está
//      a la vista (próximas o de hoy), se celebra: "celebrando".
//   3. Ante cualquier otra cosa (ya había citas, llegaron dos de golpe…) se
//      marca "vista" y nunca se muestra. Mejor callar que celebrar en falso.
//
// Privacidad: en localStorage solo se guarda el estado. Quién reservó y qué
// se deduce de los datos en cada render; nunca se persiste.

export interface Celebracion {
  cliente: string;
  servicio: string;
}

export type MarcaPrimeraReserva = "sin-reservas" | "celebrando" | "vista";

const clave = (negocioId: string) => `primera-reserva-${negocioId}`;

function leerCrudo(negocioId: string): string | null {
  try {
    return localStorage.getItem(clave(negocioId));
  } catch {
    return null;
  }
}

export function leerMarca(negocioId: string): MarcaPrimeraReserva | null {
  const valor = leerCrudo(negocioId);
  if (!valor) return null;
  if (valor === "sin-reservas" || valor === "vista" || valor === "celebrando") return valor;
  // Versiones anteriores guardaban { cliente, servicio }: se migra al estado
  // (y el efecto de persistencia sobrescribe el valor viejo con datos personales).
  if (valor.trimStart().startsWith("{")) return "celebrando";
  return "vista";
}

function guardarMarca(negocioId: string, marca: MarcaPrimeraReserva) {
  try {
    localStorage.setItem(clave(negocioId), marca);
  } catch { /* sin almacenamiento: la tarjeta simplemente no se recuerda */ }
}

type CitaMinima = Pick<CitaDto, "id" | "estadoTexto" | "nombreCliente" | "nombreServicio">;

/** El panel no muestra ninguna cita en ningún periodo que conoce. */
export function sinNingunaCita(resumen: ResumenDashboard, tendencia: PuntoDatos[]): boolean {
  return resumen.citasHoy === 0 && resumen.citasSemana === 0 && resumen.citasMes === 0
    && resumen.proximasCitas.length === 0 && tendencia.every((d) => d.citas === 0);
}

/** La única cita a la vista (próximas o de hoy, sin canceladas), o `null` si hay cero o más de una. */
export function unicaCita(resumen: ResumenDashboard, citasHoy: CitaMinima[]): Celebracion | null {
  const candidatas = new Map<string, Celebracion>();
  for (const c of resumen.proximasCitas) candidatas.set(c.id, { cliente: c.nombreCliente, servicio: c.nombreServicio });
  for (const c of citasHoy) if (c.estadoTexto !== "Cancelada") candidatas.set(c.id, { cliente: c.nombreCliente, servicio: c.nombreServicio });
  if (candidatas.size !== 1) return null;
  return [...candidatas.values()][0];
}

export interface DatosPrimeraReserva {
  resumen: ResumenDashboard;
  citasHoy: CitaMinima[];
  tendencia: PuntoDatos[];
  /** Citas de toda la vida del negocio (X-Total-Count de GET /citas sin fechas). */
  totalHistorico: number;
}

/** Decide el siguiente estado; puro para poder probarlo. */
export function siguienteMarca(actual: MarcaPrimeraReserva | null, datos: DatosPrimeraReserva): MarcaPrimeraReserva {
  const { resumen, citasHoy, tendencia, totalHistorico } = datos;
  if (actual === "vista") return actual;
  if (actual === null) return totalHistorico === 0 && sinNingunaCita(resumen, tendencia) ? "sin-reservas" : "vista";
  if (actual === "sin-reservas") {
    if (totalHistorico === 0) return actual;
    return totalHistorico === 1 && unicaCita(resumen, citasHoy) ? "celebrando" : "vista";
  }
  // actual === "celebrando": sigue mientras esa primera cita sea la única.
  return totalHistorico <= 1 && unicaCita(resumen, citasHoy) ? actual : "vista";
}

export interface UsoPrimeraReserva {
  celebracion: Celebracion | null;
  /** true solo en la visita en que se detectó: el confeti sale esa vez. */
  recienDetectada: boolean;
  cerrar: () => void;
}

/**
 * `listo` debe ser true solo cuando resumen, citas de hoy y tendencia ya
 * cargaron sin error: con datos a medias no se decide nada. El total
 * histórico lo pide el propio hook.
 */
export function usePrimeraReserva(
  negocioId: string | null | undefined,
  datos: { resumen?: ResumenDashboard; citasHoy?: CitaMinima[]; tendencia?: PuntoDatos[] },
  listo: boolean,
): UsoPrimeraReserva {
  // Lo que había al entrar: si ya estaba celebrada, el confeti no se repite.
  const [alEntrar] = useState(() => (negocioId ? leerMarca(negocioId) : null));
  const [cerrada, setCerrada] = useState(false);
  const { resumen, citasHoy, tendencia } = datos;
  const guardada = negocioId ? leerMarca(negocioId) : null;

  const { data: totalHistorico, isSuccess: totalListo } = useQuery({
    queryKey: ["citas-total-historico", negocioId],
    queryFn: async () => (await citasApi.obtenerTodas({ tamano: 1 })).total,
    enabled: !!negocioId && guardada !== "vista" && !cerrada,
    // Esperando la primera reserva, se revisa al mismo ritmo que el resumen.
    refetchInterval: guardada === "sin-reservas" ? 30_000 : false,
    staleTime: 0,
  });

  const marca = useMemo(() => {
    if (!negocioId) return null;
    const actual = leerMarca(negocioId);
    if (!listo || !totalListo || totalHistorico === undefined || !resumen || !citasHoy || !tendencia) return actual;
    return siguienteMarca(actual, { resumen, citasHoy, tendencia, totalHistorico });
  }, [negocioId, listo, totalListo, totalHistorico, resumen, citasHoy, tendencia]);

  // Persistir es el único efecto: el estado visible se deriva arriba.
  useEffect(() => {
    if (!negocioId || !marca || cerrada) return;
    if (leerCrudo(negocioId) !== marca) guardarMarca(negocioId, marca);
  }, [negocioId, marca, cerrada]);

  // Nombre y servicio salen de los datos actuales, nunca del almacenamiento.
  const celebracion = !cerrada && marca === "celebrando" && resumen && citasHoy ? unicaCita(resumen, citasHoy) : null;
  return {
    celebracion,
    recienDetectada: !!celebracion && (alEntrar === null || alEntrar === "sin-reservas"),
    cerrar: () => {
      if (negocioId) guardarMarca(negocioId, "vista");
      setCerrada(true);
    },
  };
}
