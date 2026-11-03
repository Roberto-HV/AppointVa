import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type SuscripcionResumenDto } from "../../../api/admin";
import { resumenFacturacion } from "../../../utils/negociosAdmin";

/**
 * Los datos que comparten la lista de negocios, Facturación y la ficha de un
 * negocio: métricas de cada negocio, el resumen de suscripciones y los planes.
 * Las mismas claves de consulta que antes, así que las tres pantallas leen la
 * misma caché y una invalidación las actualiza a todas.
 */
export function useDatosNegocios() {
  const {
    data: metricas = [], isLoading: cargandoMetricas, isError: errorMetricas,
    refetch: recargarMetricas, isFetching: recargandoMetricas,
  } = useQuery({
    queryKey: ["admin-negocios-metricas"],
    queryFn: adminApi.obtenerMetricas,
    staleTime: 1000 * 60 * 2,
  });

  const {
    data: suscripciones = [], isLoading: cargandoSuscripciones, isError: errorSuscripciones,
    refetch: recargarSuscripciones, isFetching: recargandoSuscripciones,
  } = useQuery({
    queryKey: ["admin-suscripciones"],
    queryFn: adminApi.obtenerSuscripciones,
    staleTime: 1000 * 60,
  });

  const { data: planes = [], isError: errorPlanes, refetch: recargarPlanes } = useQuery({
    queryKey: ["planes"],
    queryFn: adminApi.obtenerPlanes,
  });

  const suscripcionMap = useMemo(
    () => Object.fromEntries(suscripciones.map((s) => [s.negocioId, s])) as Record<string, SuscripcionResumenDto | undefined>,
    [suscripciones]
  );

  // Un solo resumen para la tira de KPIs y el pie de Facturación (G3): antes
  // cada uno contaba a su manera y "Con plan 2" convivía con "$0/mes".
  const resumen = useMemo(() => resumenFacturacion(suscripciones), [suscripciones]);

  // Un fallo de cualquiera de las dos consultas deja los KPIs en cero: se
  // muestra el error con "Reintentar" en vez de cifras falsas.
  const errorPanel = errorMetricas || errorSuscripciones;
  const reintentarPanel = () => {
    if (errorMetricas) recargarMetricas();
    if (errorSuscripciones) recargarSuscripciones();
  };

  return {
    metricas, cargandoMetricas, errorMetricas, recargarMetricas, recargandoMetricas,
    suscripciones, cargandoSuscripciones, errorSuscripciones, recargarSuscripciones, recargandoSuscripciones,
    planes, errorPlanes, recargarPlanes,
    suscripcionMap, resumen,
    errorPanel, reintentarPanel,
    cargandoPanel: cargandoMetricas || cargandoSuscripciones,
    reintentandoPanel: recargandoMetricas || recargandoSuscripciones,
  };
}
