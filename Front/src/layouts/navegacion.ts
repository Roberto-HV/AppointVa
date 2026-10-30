import type { ComponentType } from "react";
import {
  LayoutDashboard, CalendarDays, Users, Scissors, UserCheck, Building2, BarChart2,
  UserCircle, Images, ClipboardList, Tag, CreditCard, Star, Hourglass, Monitor,
} from "lucide-react";
import { getSectorTerms, type SectorTerms } from "../hooks/useSectorTerms";
import type { SectorFeatures } from "../hooks/useSectorFeatures";
import { RUTA_RECEPCION } from "../lib/recepcion";

// Entradas del menú lateral del panel (DashboardLayout y su cajón móvil).

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** No navega: abre la confirmación del modo recepción (I6). */
  recepcion?: boolean;
}

/** Sección del menú con rótulo. `titulo` vacío: lista sin rótulo (empleados). */
export interface NavGrupo {
  titulo: string;
  items: NavItem[];
}

export type FeaturesNav = Pick<SectorFeatures, "pagos" | "galeria" | "descuentos" | "listaEspera">;

export const navEmpleado = (terms: SectorTerms): NavGrupo[] => [
  {
    titulo: "",
    items: [
      { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
      { to: "/dashboard/citas", label: `Mis ${terms.citas.toLowerCase()}`, icon: CalendarDays },
      { to: "/dashboard/pagos", label: "Pagos", icon: CreditCard },
      { to: "/dashboard/mi-perfil", label: "Mi perfil", icon: UserCircle },
    ],
  },
];

/**
 * Menú de la dueña en secciones (I5). Antes eran 13 entradas en una columna;
 * ahora van agrupadas por tarea, como Fresha. Las rutas no cambian. Seguridad
 * pasó al menú de usuario: es una tarea de una sola vez. Lista de espera solo
 * aparece cuando el negocio la tiene activa, y Recepción abre su confirmación.
 */
export function navPropietario(terms: SectorTerms, features: FeaturesNav): NavGrupo[] {
  const si = (condicion: boolean, item: NavItem): NavItem[] => (condicion ? [item] : []);
  return [
    {
      titulo: "Agenda",
      items: [
        { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
        { to: "/dashboard/citas", label: terms.citas, icon: CalendarDays },
        ...si(features.pagos, { to: "/dashboard/pagos", label: "Pagos", icon: CreditCard }),
        ...si(features.listaEspera, { to: "/dashboard/espera", label: "Lista de espera", icon: Hourglass }),
        { to: RUTA_RECEPCION, label: "Recepción", icon: Monitor, recepcion: true },
      ],
    },
    {
      titulo: `${terms.clientes} y equipo`,
      items: [
        { to: "/dashboard/clientes", label: terms.clientes, icon: UserCheck },
        { to: "/dashboard/resenas", label: "Reseñas", icon: Star },
        { to: "/dashboard/empleados", label: terms.empleados, icon: Users },
      ],
    },
    {
      titulo: "Catálogo",
      items: [
        { to: "/dashboard/servicios", label: terms.servicios, icon: Scissors },
        ...si(features.descuentos, { to: "/dashboard/descuentos", label: "Descuentos", icon: Tag }),
        { to: "/dashboard/intake", label: "Cuestionario", icon: ClipboardList },
      ],
    },
    {
      titulo: "Negocio",
      items: [
        { to: "/dashboard/perfil", label: "Mi negocio", icon: Building2 },
        ...si(features.galeria, { to: "/dashboard/galeria", label: "Galería", icon: Images }),
        { to: "/dashboard/reportes", label: "Reportes", icon: BarChart2 },
      ],
    },
  ];
}

/** Menú de la dueña según el sector, sin depender del perfil cargado (salud oculta Pagos, Galería y Descuentos). */
export function getNavGrupos(sector: string, listaEspera = false): NavGrupo[] {
  const salud = sector === "salud";
  return navPropietario(getSectorTerms(sector), {
    pagos: !salud,
    galeria: !salud,
    descuentos: !salud,
    listaEspera: !salud && listaEspera,
  });
}
