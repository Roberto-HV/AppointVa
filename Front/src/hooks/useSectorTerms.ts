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
  const { data } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    staleTime: 5 * 60 * 1000,
  });
  return getSectorTerms(data?.sector);
}
