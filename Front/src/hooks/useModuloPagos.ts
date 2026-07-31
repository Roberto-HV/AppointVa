import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

export function useModuloPagos() {
  const { data, isLoading } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });
  return {
    habilitado: data?.moduloPagosHabilitado ?? false,
    isLoading,
  };
}
