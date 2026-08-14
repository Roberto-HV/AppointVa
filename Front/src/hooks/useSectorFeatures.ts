import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

export interface SectorFeatures {
  pagos: boolean;
  galeria: boolean;
  listaEspera: boolean;
  descuentos: boolean;
}

export function useSectorFeatures(): SectorFeatures & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });

  if (data?.sector === "salud") {
    return { pagos: false, galeria: false, listaEspera: false, descuentos: false, isLoading };
  }

  return {
    pagos: data?.moduloPagosHabilitado ?? false,
    galeria: true,
    listaEspera: data?.listaEsperaActiva ?? false,
    descuentos: true,
    isLoading,
  };
}
