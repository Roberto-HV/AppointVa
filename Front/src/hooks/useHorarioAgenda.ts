import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

/**
 * Horario y días bloqueados del negocio para sombrear la rejilla de la agenda y
 * decidir qué huecos abren "Nueva cita". Mismas claves que Mi negocio, así un
 * cambio de horario se ve aquí al volver.
 */
export function useHorarioAgenda() {
  const { data: horarios, isFetched: horarioCargado } = useQuery({
    queryKey: ["horarios-negocio"],
    queryFn: () => negociosApi.obtenerHorarios(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: bloqueados } = useQuery({
    queryKey: ["dias-bloqueados"],
    queryFn: () => negociosApi.obtenerDiasBloqueados(),
    staleTime: 1000 * 60 * 5,
  });
  // `horarioCargado`: ya respondió (o falló) y las horas de la rejilla no van a cambiar por él.
  return { horarios, bloqueados, horarioCargado };
}
