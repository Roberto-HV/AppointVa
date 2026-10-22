import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LayoutDashboard, CalendarDays, Users, Scissors, UserCheck, Building2, Link, Copy, Check, BarChart2, ShieldCheck, UserCircle, Images, ClipboardList, Tag, LogOut, ChevronLeft, ChevronRight, BookOpen, Moon, Sun, CreditCard, Star } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import LogoMarca from "../components/LogoMarca";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { negociosApi } from "../api/negocios";
import { citasApi, ESTADOS } from "../api/citas";
import { useToastStore } from "../store/toastStore";
import { Tooltip } from "../components/ui/Tooltip";
import AvisoInactividad from "../components/AvisoInactividad";
import { NotificacionesBell } from '../components/dashboard/NotificacionesBell';
import { EncuestaSatisfaccionModal } from '../components/dashboard/EncuestaSatisfaccionModal';
import AvisoActivacionPendiente from '../components/dashboard/AvisoActivacionPendiente';
import { encuestaApi } from '../api/encuesta';
import { toUtcDate, capitalizarPrimera, formatHoraDe } from '../utils/formatters';
import { useInactividadTimeout } from '../hooks/useInactividadTimeout';
import { useSectorTerms, getSectorTerms, type SectorTerms } from "../hooks/useSectorTerms";
import { useSectorFeatures } from "../hooks/useSectorFeatures";
import { hoy as hoyLocal } from "../utils/fechas";
import { useCopiarAlPortapapeles } from "../hooks/useCopiarAlPortapapeles";

/** true desde `xl` (1280px): ahí el sidebar es fijo y no un cajón. */
function useEsEscritorio() {
  const consulta = "(min-width: 1280px)";
  const [es, setEs] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(consulta).matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(consulta);
    const onChange = () => setEs(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return es;
}

function FechaHoraActual({ className = "text-slate-500 dark:text-slate-400" }: { className?: string }) {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const fecha = ahora.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const hora = formatHoraDe(ahora);
  return (
    <span className={`hidden sm:block select-none text-sm tabular-nums ${className}`}>
      {capitalizarPrimera(fecha)} · {hora}
    </span>
  );
}

interface UserMenuContentProps {
  usuario: { fotoUrl?: string | null; nombreCompleto: string; email: string; rol: string } | null;
  perfil?: { planNombre?: string | null } | null;
  iniciales: string;
  rolChip: { label: string; cls: string };
  rol: string;
  onProfile: () => void;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

function UserMenuContent({ usuario, perfil, iniciales, rolChip, rol, onProfile, onLogout, theme, onToggleTheme }: UserMenuContentProps) {
  return (
    <div className="py-1">
      <div className="px-4 pt-3 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-600 dark:ring-1 dark:ring-white/25 flex items-center justify-center shrink-0 overflow-hidden">
          {usuario?.fotoUrl
            ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-white">{iniciales}</span>
          }
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{usuario?.email}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${rolChip.cls}`}>
              {rolChip.label}
            </span>
            {perfil?.planNombre && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-transparent border-[1.5px] border-amber-600/40 text-amber-700 dark:border-amber-400/35 dark:text-amber-300">
                {perfil.planNombre}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3 my-1" />
      <button
        onClick={onProfile}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
      >
        <UserCircle size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
        Mi perfil
      </button>
      <a
        href={rol === "Empleado" ? "/manuales/manual-empleado.html" : "/manuales/manual-propietario.html"}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
      >
        <BookOpen size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
        Manual de usuario
      </a>
      <button
        onClick={onToggleTheme}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition"
      >
        {theme === "dark"
          ? <Sun size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
          : <Moon size={15} className="text-slate-400 shrink-0" />
        }
        {theme === "dark" ? "Modo claro" : "Modo oscuro"}
      </button>
      <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3 my-1" />
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
      >
        <LogOut size={15} className="shrink-0" />
        Cerrar sesión
      </button>
      <div className="h-2" />
    </div>
  );
}

const navEmpleado = (terms: SectorTerms): NavItem[] => [
  { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
  { to: "/dashboard/citas", label: `Mis ${terms.citas.toLowerCase()}`, icon: CalendarDays },
  { to: "/dashboard/pagos", label: "Pagos", icon: CreditCard },
  { to: "/dashboard/mi-perfil", label: "Mi perfil", icon: UserCircle },
];

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const HIDDEN_IN_SALUD = new Set([
  "/dashboard/pagos",
  "/dashboard/galeria",
  "/dashboard/descuentos",
]);

export function getNav(sector: string): NavItem[] {
  const terms = getSectorTerms(sector);
  const all: NavItem[] = [
    { to: "/dashboard",            label: "Inicio",          end: true, icon: LayoutDashboard },
    { to: "/dashboard/citas",      label: terms.citas,                  icon: CalendarDays },
    { to: "/dashboard/pagos",      label: "Pagos",                      icon: CreditCard },
    { to: "/dashboard/clientes",   label: terms.clientes,               icon: UserCheck },
    { to: "/dashboard/empleados",  label: terms.empleados,              icon: Users },
    { to: "/dashboard/servicios",  label: terms.servicios,              icon: Scissors },
    { to: "/dashboard/descuentos", label: "Descuentos",                 icon: Tag },
    { to: "/dashboard/resenas",    label: "Reseñas",                    icon: Star },
    { to: "/dashboard/reportes",   label: "Reportes",                   icon: BarChart2 },
    { to: "/dashboard/perfil",     label: "Mi negocio",                 icon: Building2 },
    { to: "/dashboard/galeria",    label: "Galería",                    icon: Images },
    { to: "/dashboard/intake",     label: "Cuestionario",               icon: ClipboardList },
    { to: "/dashboard/seguridad",  label: "Seguridad",                  icon: ShieldCheck },
  ];
  return sector === "salud"
    ? all.filter((item) => !HIDDEN_IN_SALUD.has(item.to))
    : all;
}

export default function DashboardLayout() {
  const { usuario, refreshToken, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToastStore();
  const { theme, toggle: toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = () => setSidebarCollapsed(o => {
    const next = !o;
    try { localStorage.setItem("sidebar-collapsed", next ? "1" : "0"); } catch {}
    return next;
  });
  const { copiado, copiar } = useCopiarAlPortapapeles();
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const prevPendientesRef = useRef<number | null>(null);
  const headerUserRef = useRef<HTMLDivElement>(null);
  const desktopUserRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const botonMenuRef = useRef<HTMLButtonElement>(null);
  const botonCerrarRef = useRef<HTMLButtonElement>(null);
  const botonUsuarioMovilRef = useRef<HTMLButtonElement>(null);
  const botonUsuarioEscritorioRef = useRef<HTMLButtonElement>(null);
  const esEscritorio = useEsEscritorio();

  const location = useLocation();
  const esEmpleado = usuario?.rol === "Empleado";

  const terms = useSectorTerms();
  const features = useSectorFeatures();

  const NAV_PROPIETARIO: NavItem[] = [
    { to: "/dashboard",            label: "Inicio",          end: true, icon: LayoutDashboard },
    { to: "/dashboard/citas",      label: terms.citas,                  icon: CalendarDays },
    ...(features.pagos      ? [{ to: "/dashboard/pagos",      label: "Pagos",      icon: CreditCard }] : []),
    { to: "/dashboard/clientes",   label: terms.clientes,               icon: UserCheck },
    { to: "/dashboard/empleados",  label: terms.empleados,              icon: Users },
    { to: "/dashboard/servicios",  label: terms.servicios,              icon: Scissors },
    ...(features.descuentos ? [{ to: "/dashboard/descuentos", label: "Descuentos", icon: Tag }]      : []),
    { to: "/dashboard/resenas",    label: "Reseñas",                    icon: Star },
    { to: "/dashboard/reportes",   label: "Reportes",                   icon: BarChart2 },
    { to: "/dashboard/perfil",     label: "Mi negocio",                 icon: Building2 },
    ...(features.galeria    ? [{ to: "/dashboard/galeria",    label: "Galería",    icon: Images }]   : []),
    { to: "/dashboard/intake",     label: "Cuestionario",               icon: ClipboardList },
    { to: "/dashboard/seguridad",  label: "Seguridad",                  icon: ShieldCheck },
  ];

  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil"],
    queryFn: negociosApi.obtenerPerfil,
    enabled: !esEmpleado,
    staleTime: 1000 * 60 * 5,
  });

  const { data: encuestaEstado } = useQuery({
    queryKey: ["encuesta-estado"],
    queryFn: encuestaApi.obtenerEstado,
    enabled: usuario?.rol === "Propietario",
    staleTime: 1000 * 60 * 60,
  });
  const [encuestaCerrada, setEncuestaCerrada] = useState(false);

  const navItems = esEmpleado ? navEmpleado(terms) : NAV_PROPIETARIO;

  useEffect(() => {
    if (
      perfil?.sector === "salud" &&
      (location.pathname.startsWith("/dashboard/pagos") ||
        location.pathname.startsWith("/dashboard/galeria") ||
        location.pathname.startsWith("/dashboard/descuentos"))
    ) {
      navigate("/dashboard", { replace: true });
    }
  }, [perfil?.sector, location.pathname, navigate]);

  // Fecha local: con `toISOString()` el contador cambiaba a mañana desde las 18:00 (UTC-6).
  const hoy = hoyLocal();
  const { data: citasHoy = [] } = useQuery({
    queryKey: ["citas-badge", hoy],
    queryFn: () => citasApi.obtenerTodas({ desde: hoy, hasta: hoy }),
    staleTime: 0,
    refetchInterval: 30_000,
    select: (pagina) => pagina.datos,
  });
  const ahora = new Date();
  const hoyCnt = citasHoy.filter((c) =>
    c.estado !== ESTADOS.Cancelada &&
    c.estado !== ESTADOS.Inasistencia &&
    toUtcDate(c.finEn) > ahora
  ).length;
  const pendientesCnt = citasHoy.filter((c) => c.estado === ESTADOS.Pendiente).length;

  useEffect(() => {
    if (prevPendientesRef.current !== null && pendientesCnt > prevPendientesRef.current) {
      const nuevas = pendientesCnt - prevPendientesRef.current;
      toast(`${nuevas} nueva${nuevas > 1 ? "s" : ""} cita${nuevas > 1 ? "s" : ""} pendiente${nuevas > 1 ? "s" : ""}`);
    }
    prevPendientesRef.current = pendientesCnt;
  }, [pendientesCnt, toast]);

  const iniciales = (usuario?.nombreCompleto ?? "?")
    .split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();

  const bookingUrl = perfil ? `${window.location.origin}/b/${perfil.slug}` : "";

  const copiarEnlace = () => { void copiar(bookingUrl); };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      cerrarSesion();
      navigate("/login");
    }
  };

  const inactividad = useInactividadTimeout(handleLogout);

  // El cajón es modal por debajo de `xl`: al cerrarlo, el foco vuelve al botón
  // que lo abrió (antes se perdía en <body>).
  const cerrarSidebar = () => {
    const estabaAbierto = sidebarOpen;
    setSidebarOpen(false);
    if (estabaAbierto && !esEscritorio) botonMenuRef.current?.focus();
  };

  // Cajón abierto: foco al botón de cerrar, Escape lo cierra y Tab no sale de él.
  useEffect(() => {
    if (!sidebarOpen || esEscritorio) return;
    botonCerrarRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        botonMenuRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !sidebarRef.current) return;
      const enfocables = sidebarRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen, esEscritorio]);

  // Menú de usuario: se cierra al tocar o enfocar fuera, y con Escape (el foco
  // vuelve al avatar). `pointerdown` cubre ratón y toque.
  useEffect(() => {
    if (!headerMenuOpen) return;
    const fuera = (target: Node) =>
      !headerUserRef.current?.contains(target) && !desktopUserRef.current?.contains(target);
    const onPointer = (e: PointerEvent) => { if (fuera(e.target as Node)) setHeaderMenuOpen(false); };
    const onFocus = (e: FocusEvent) => { if (fuera(e.target as Node)) setHeaderMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setHeaderMenuOpen(false);
      (esEscritorio ? botonUsuarioEscritorioRef : botonUsuarioMovilRef).current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey);
    };
  }, [headerMenuOpen, esEscritorio]);

  // Sector salud: el esquema azul se conserva, pero sale de tokens con
  // contraste en ambos temas (antes: estilos en línea con texto slate a 1.2:1).
  const salud = perfil?.sector === "salud";

  // Salud cambia la rampa neutra a la fría y el acento a #0F4C75 (src/index.css).
  // Va en <html> y no en el contenedor para que también lo hereden los portales
  // de Radix (diálogos, menús); se retira al salir del panel.
  useEffect(() => {
    const root = document.documentElement;
    if (salud) root.dataset.sector = "salud";
    else delete root.dataset.sector;
    return () => { delete root.dataset.sector; };
  }, [salud]);

  const temaNav = salud
    ? {
        aside: "bg-sidebar-salud border-white/10",
        activo: "bg-sidebar-salud-active text-white font-semibold shadow-md",
        iconoActivo: "text-white",
        fondoIconoActivo: "bg-white/20",
        inactivo: "text-sidebar-salud-fg hover:bg-sidebar-salud-hover",
        icono: "text-sidebar-salud-muted",
        pie: "text-sidebar-salud-fg hover:bg-sidebar-salud-hover",
        borde: "border-white/10",
      }
    : {
        aside: "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700/50",
        // Nav activo con el acento terracota: tinte suave, texto en tinta (≥ 13:1) e icono en terracota.
        activo: "bg-accent-brand/10 text-foreground font-semibold",
        iconoActivo: "text-accent-brand",
        fondoIconoActivo: "bg-transparent",
        inactivo: "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white",
        icono: "text-slate-500 dark:text-slate-400",
        pie: "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white",
        borde: "border-slate-100 dark:border-slate-700/50",
      };
  const etiquetaPendientes = `${pendientesCnt} cita${pendientesCnt !== 1 ? "s" : ""} pendiente${pendientesCnt !== 1 ? "s" : ""} por confirmar`;

  // Mismo aviso en el header móvil y en la barra de escritorio, y lleva a la
  // lista filtrada (antes era un chip sin acción y solo en el teléfono).
  const chipPendientes = pendientesCnt > 0 && (
    <NavLink
      to="/dashboard/citas?estado=Pendiente"
      aria-label={`${etiquetaPendientes}. Ver en ${terms.citas.toLowerCase()}`}
      className="inline-flex items-center min-h-[44px] lg:min-h-[36px] px-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-1 bg-status-pending-bg text-status-pending-fg border border-status-pending-dot text-xs font-bold px-2 py-0.5 rounded-full hover:opacity-80 transition">
        {pendientesCnt > 9 ? "9+" : pendientesCnt} pendiente{pendientesCnt !== 1 ? "s" : ""}
      </span>
    </NavLink>
  );

  const rolChip = usuario?.rol === "Empleado"
    ? { label: "Empleado",    cls: "bg-transparent border-[1.5px] border-blue-600/40 text-blue-700 dark:border-blue-300/40 dark:text-blue-300" }
    : usuario?.rol === "SuperAdmin"
    ? { label: "Super Admin", cls: "bg-transparent border-[1.5px] border-purple-700/40 text-purple-700 dark:border-purple-300/40 dark:text-purple-300" }
    : { label: "Propietario", cls: "bg-transparent border-[1.5px] border-slate-500/35 text-slate-600 dark:border-slate-400/30 dark:text-slate-400" };

  const menuProps = {
    usuario,
    perfil,
    iniciales,
    rolChip,
    rol: usuario?.rol ?? "",
    onProfile: () => { navigate("/dashboard/mi-perfil"); setHeaderMenuOpen(false); cerrarSidebar(); },
    onLogout: () => { setHeaderMenuOpen(false); handleLogout(); },
    theme,
    onToggleTheme: toggleTheme,
  };

  // Resetea scroll al montar — iOS puede llegar con viewport desplazado por el teclado del login
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  return (
    <div
      className="h-dvh flex overflow-hidden bg-white dark:bg-slate-950"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Franja tras la barra de estado: su texto es blanco fijo por black-translucent y el
          header del dashboard es claro, así que necesita un fondo oscuro propio. */}
      <div
        aria-hidden="true"
        className="fixed top-0 inset-x-0 z-[60] bg-slate-900 pointer-events-none"
        style={{ height: "env(safe-area-inset-top)" }}
      />

      {/* ── Overlay backdrop (móvil) — siempre montado, fade vía inline style ── */}
      <div
        className="fixed inset-0 z-40 xl:hidden transition-colors duration-200"
        style={{
          backgroundColor: sidebarOpen ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0)",
          pointerEvents: sidebarOpen ? "auto" : "none",
          touchAction: "manipulation",
        }}
        onClick={cerrarSidebar}
      />

      {/* ── Sidebar ── */}
      <aside
        id="menu-principal"
        ref={sidebarRef}
        aria-label="Menú principal"
        // Cerrado por debajo de `xl`, el cajón está fuera de pantalla: `inert`
        // saca sus enlaces del orden de tabulación y del lector de pantalla.
        inert={!esEscritorio && !sidebarOpen}
        {...(!esEscritorio && sidebarOpen ? { role: "dialog", "aria-modal": true } : {})}
        className={`
          fixed inset-y-0 left-0 z-50 w-64 border-r ${temaNav.aside} flex flex-col
          transition-all duration-200 ease-in-out
          xl:static xl:z-auto xl:translate-x-0 xl:h-full xl:shrink-0
          ${sidebarCollapsed ? "xl:w-16" : "xl:w-60"}
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + cerrar móvil */}
        <div className="relative px-5 py-3 flex items-center justify-center shrink-0">
          <div className="flex flex-col items-center gap-1">
            <NavLink to="/dashboard" end onClick={cerrarSidebar}>
              {sidebarCollapsed ? (
                <>
                  <img src="/icons/LogoApp.png" alt="AppointVa" className="h-7 object-contain transition-all duration-200 block dark:hidden" />
                  <img src="/icons/LogoAppOscuro.png" alt="AppointVa" className="h-7 object-contain transition-all duration-200 hidden dark:block" />
                </>
              ) : theme === "dark" || salud ? (
                <LogoMarca prioridad variante="oscuro" className="h-10 transition-all duration-200" />
              ) : (
                <img src="/icons/Banner.png" alt="AppointVa" className="h-10 object-contain transition-all duration-200" />
              )}
            </NavLink>
            {!sidebarCollapsed && esEmpleado && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Empleado
              </span>
            )}
          </div>
          {/* Cerrar — solo móvil */}
          <button
            ref={botonCerrarRef}
            onClick={cerrarSidebar}
            aria-label="Cerrar menú"
            className={`absolute right-1 xl:hidden w-11 h-11 inline-flex items-center justify-center rounded-lg ${temaNav.pie}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${sidebarCollapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const esCitas = item.to === "/dashboard/citas";
            const link = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={cerrarSidebar}
                className={({ isActive }) =>
                  `flex items-center rounded-xl text-sm font-medium transition-all ${
                    sidebarCollapsed ? "justify-center px-0 py-1" : "gap-3 px-3 py-2.5"
                  } ${
                    isActive ? temaNav.activo : temaNav.inactivo
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`relative rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      sidebarCollapsed ? "w-11 h-11" : "w-7 h-7"
                    } ${isActive && !sidebarCollapsed ? temaNav.fondoIconoActivo : "bg-transparent"}`}>
                      <Icon size={sidebarCollapsed ? 22 : 15} className={isActive ? temaNav.iconoActivo : temaNav.icono} />
                      {/* Colapsado no cabe el contador: un punto avisa que hay pendientes. */}
                      {sidebarCollapsed && esCitas && pendientesCnt > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-status-pending-dot ring-2 ring-white dark:ring-slate-900" aria-hidden="true" />
                      )}
                    </div>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 whitespace-nowrap">{item.label}</span>
                        {esCitas && hoyCnt > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                            pendientesCnt > 0
                              ? "bg-status-pending-bg text-status-pending-fg border border-status-pending-dot"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                          }`}>
                            {hoyCnt > 9 ? "9+" : hoyCnt}
                          </span>
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
            );
            return sidebarCollapsed ? (
              <Tooltip key={item.to} text={item.to === "/dashboard/citas" && pendientesCnt > 0 ? `${item.label} · ${etiquetaPendientes}` : item.label} side="right">
                {/* span wrapper evita que asChild rompa el className-function de NavLink */}
                <span className="block">{link}</span>
              </Tooltip>
            ) : link;
          })}
        </nav>

        {/* Enlace de reservas */}
        {!esEmpleado && bookingUrl && (
          <div className={`p-3 border-t ${temaNav.borde} shrink-0 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
            {sidebarCollapsed ? (
              <Tooltip text="Enlace de reservas" side="right">
                <span className="block">
                  <button
                    onClick={copiarEnlace}
                    aria-label={copiado ? "Enlace de reservas copiado" : "Copiar enlace de reservas"}
                    className={`w-11 h-11 flex items-center justify-center rounded-xl transition ${temaNav.pie}`}
                  >
                    {copiado ? <Check size={20} className="text-emerald-500" /> : <Link size={20} />}
                  </button>
                </span>
              </Tooltip>
            ) : (
              <button
                onClick={copiarEnlace}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 transition group"
              >
                <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0">
                  {copiado ? <Check size={12} className="text-emerald-500" /> : <Link size={12} className="text-slate-500" />}
                </div>
                <span className="flex-1 text-left text-slate-600 dark:text-slate-300 truncate">
                  {copiado ? "¡Copiado!" : "Enlace de reservas"}
                </span>
                {!copiado && <Copy size={11} className="text-slate-300 group-hover:text-slate-400 transition shrink-0" />}
              </button>
            )}
          </div>
        )}

        {/* Colapsar — vive en el pie porque su padding es constante: a diferencia del borde
            derecho del sidebar, este punto no se desplaza al cambiar el ancho. */}
        <div className={`hidden xl:block p-3 border-t ${temaNav.borde} shrink-0 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
          {sidebarCollapsed ? (
            <Tooltip text="Expandir menú" side="right">
              <span className="block">
                <button
                  onClick={toggleCollapsed}
                  aria-label="Expandir menú"
                  className={`w-11 h-11 flex items-center justify-center rounded-xl transition ${temaNav.pie}`}
                >
                  <ChevronRight size={20} />
                </button>
              </span>
            </Tooltip>
          ) : (
            <button
              onClick={toggleCollapsed}
              aria-label="Colapsar menú"
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition ${temaNav.pie}`}
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <ChevronLeft size={14} />
              </div>
              <span className="flex-1 text-left truncate">Colapsar menú</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Columna derecha ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Barra superior móvil ── */}
        <header
          className={`xl:hidden border-b px-4 py-2 flex items-center gap-3 shrink-0 z-30 ${
            salud ? "bg-sidebar-salud-active border-white/10" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700/50"
          }`}
        >
          <button
            ref={botonMenuRef}
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            aria-controls="menu-principal"
            className="w-11 h-11 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
          <NavLink to="/dashboard" end>
            <img src="/icons/LogoApp.png" alt="AppointVa" className="h-7 object-contain rounded-lg block dark:hidden" />
            <img src="/icons/LogoAppOscuro.png" alt="AppointVa" className="h-7 object-contain rounded-lg hidden dark:block" />
          </NavLink>
          {esEmpleado && (
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Empleado
            </span>
          )}
          <div ref={headerUserRef} className="ml-auto flex items-center gap-2 relative">
            <FechaHoraActual className={salud ? "text-sidebar-salud-fg" : undefined} />
            {!esEmpleado && <NotificacionesBell />}
            {chipPendientes}
            <button
              ref={botonUsuarioMovilRef}
              onClick={() => setHeaderMenuOpen((o) => !o)}
              aria-label="Menú de usuario"
              aria-expanded={headerMenuOpen}
              aria-controls="menu-usuario-movil"
              className="w-11 h-11 rounded-full flex items-center justify-center"
            >
              <span className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-600 dark:ring-1 dark:ring-white/25 flex items-center justify-center overflow-hidden">
                {usuario?.fotoUrl
                  ? <img src={usuario.fotoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[10px] font-bold text-white">{iniciales}</span>
                }
              </span>
            </button>
            {headerMenuOpen && (
              <div id="menu-usuario-movil" className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden z-50">
                <UserMenuContent {...menuProps} />
              </div>
            )}
          </div>
        </header>

        {/* ── Banner cuenta inactiva ── */}
        {!esEmpleado && perfil && !perfil.activo && <AvisoActivacionPendiente />}

        {/* ── Contenido principal ── */}
        {/* `--barra-accion` lo publica la página que tenga una barra de acción
            pegada al fondo. Sin ella el relleno es cero; con ella, enfocar o
            desplazarse a un campo del final no lo deja debajo de la barra. */}
        <main
          className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 scroll-pb-[var(--barra-accion,0px)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Desktop topbar — hidden on mobile (mobile has its own header) */}
          <header className="hidden xl:flex items-center justify-end gap-3 border-b border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
            <FechaHoraActual />
            {chipPendientes}
            {!esEmpleado && <NotificacionesBell />}
            <div ref={desktopUserRef} className="relative flex items-center">
              <button
                ref={botonUsuarioEscritorioRef}
                onClick={() => setHeaderMenuOpen((o) => !o)}
                aria-label="Menú de usuario"
                aria-expanded={headerMenuOpen}
                aria-controls="menu-usuario-escritorio"
                className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-600 dark:ring-1 dark:ring-white/25 flex items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:focus-visible:ring-2 dark:focus-visible:ring-ring"
              >
                {usuario?.fotoUrl
                  ? <img src={usuario.fotoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[10px] font-bold text-white">{iniciales}</span>
                }
              </button>
              {headerMenuOpen && (
                <div id="menu-usuario-escritorio" className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden z-50">
                  <UserMenuContent {...menuProps} />
                </div>
              )}
            </div>
          </header>
          <Outlet />
        </main>

      </div>

      <AvisoInactividad abierto={inactividad.aviso} onSeguir={inactividad.seguir} onCerrarSesion={() => handleLogout()} />

      {encuestaEstado?.mostrar && !encuestaCerrada && (
        <EncuestaSatisfaccionModal onCerrar={() => setEncuestaCerrada(true)} />
      )}
    </div>
  );
}
