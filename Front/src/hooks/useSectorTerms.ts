import { useQuery } from "@tanstack/react-query";
import { negociosApi } from "../api/negocios";

export interface SectorTerms {
  cita: string;
  citas: string;
  cliente: string;
  clientes: string;
  empleado: string;
  empleados: string;
  servicio: string;
  servicios: string;
}

const TERMINOS_BELLEZA: SectorTerms = {
  cita: "Cita",
  citas: "Citas",
  cliente: "Cliente",
  clientes: "Clientes",
  empleado: "Empleado",
  empleados: "Empleados",
  servicio: "Servicio",
  servicios: "Servicios",
};

const TERMINOS_SALUD: SectorTerms = {
  cita: "Consulta",
  citas: "Consultas",
  cliente: "Paciente",
  clientes: "Pacientes",
  empleado: "Profesional",
  empleados: "Profesionales",
  servicio: "Tipo de consulta",
  servicios: "Tipos de consulta",
};

export function getSectorTerms(sector: string | null | undefined): SectorTerms {
  return sector === "salud" ? TERMINOS_SALUD : TERMINOS_BELLEZA;
}

export function useSectorTerms(): SectorTerms {
  return getSectorTerms(useSector());
}

/**
 * Perfil del negocio en sesión. Una sola consulta para el sector y el nombre:
 * TanStack la deduplica entre filas y pantallas, así que leerla desde cualquier
 * componente no añade peticiones.
 */
function usePerfilNegocio() {
  const { data } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });
  return data;
}

/** Sector del negocio en sesión (mismo query que el perfil; `undefined` mientras carga). */
export function useSector(): string | undefined {
  return usePerfilNegocio()?.sector;
}

/**
 * Nombre del negocio en sesión (`undefined` mientras carga). Lo usan los mensajes
 * de WhatsApp como respaldo cuando la pantalla no pasa `nombreNegocio`: el Inicio
 * del empleado no monta ninguna consulta de perfil propia, y sin esto el cliente
 * recibía el aviso sin saber quién se lo manda.
 */
export function useNombreNegocio(): string | undefined {
  return usePerfilNegocio()?.nombre;
}
