import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LayoutDashboard, CalendarDays, Users, Scissors, UserCheck, Building2, Link, Copy, Check, BarChart2, ShieldCheck, UserCircle, Images, ClipboardList, Tag, LogOut, ChevronLeft, ChevronRight, Mail, BookOpen, Moon, Sun, CreditCard, Star } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { negociosApi } from "../api/negocios";
import { citasApi, ESTADOS } from "../api/citas";
import { useToastStore } from "../store/toastStore";
import { Tooltip } from "../components/ui/Tooltip";
import { NotificacionesBell } from '../components/dashboard/NotificacionesBell';
import { EncuestaSatisfaccionModal } from '../components/dashboard/EncuestaSatisfaccionModal';
import { encuestaApi } from '../api/encuesta';
import { toUtcDate } from '../utils/formatters';
import { useInactividadTimeout } from '../hooks/useInactividadTimeout';
import { useSectorTerms, getSectorTerms } from "../hooks/useSectorTerms";
import { useSectorFeatures } from "../hooks/useSectorFeatures";

function FechaHoraActual() {
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
  const hora = ahora.toLocaleTimeString('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return (
    <span className="hidden sm:block select-none text-sm capitalize text-slate-500 dark:text-slate-400">
      {fecha} · {hora}
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
        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
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
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
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
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
      >
        <LogOut size={15} className="shrink-0" />
        Cerrar sesión
      </button>
      <div className="h-2" />
    </div>
  );
}

const NAV_EMPLEADO = [
  { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
  { to: "/dashboard/citas", label: "Mis citas", icon: CalendarDays },
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
  const [copiado, setCopiado] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const prevPendientesRef = useRef<number | null>(null);
  const headerUserRef = useRef<HTMLDivElement>(null);
  const desktopUserRef = useRef<HTMLDivElement>(null);

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

  const navItems = esEmpleado ? NAV_EMPLEADO : NAV_PROPIETARIO;

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

  const hoy = new Date().toISOString().split("T")[0];
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

  const copiarEnlace = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard failed silently */ }
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      cerrarSesion();
      navigate("/login");
    }
  };

  useInactividadTimeout(handleLogout);

  const cerrarSidebar = () => {
    (document.activeElement as HTMLElement)?.blur();
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const fueraHeader = !headerUserRef.current?.contains(target);
      const fueraDesktop = !desktopUserRef.current?.contains(target);
      if (fueraHeader && fueraDesktop) setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [headerMenuOpen]);

  const rolChip = usuario?.rol === "Empleado"
    ? { label: "Empleado", cls: "bg-blue-100 text-blue-700" }
    : usuario?.rol === "SuperAdmin"
    ? { label: "Super Admin", cls: "bg-purple-100 text-purple-700" }
    : { label: "Propietario", cls: "bg-slate-100 text-slate-600" };

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
    <div className="h-dvh flex overflow-hidden bg-white dark:bg-slate-950">

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
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-700/50 flex flex-col
          transition-all duration-200 ease-in-out
          xl:static xl:translate-x-0 xl:h-full xl:shrink-0
          ${sidebarCollapsed ? "xl:w-16" : "xl:w-60"}
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={perfil?.sector === "salud" ? { backgroundColor: "#0F4C75" } : undefined}
      >
        {/* Logo + cerrar móvil */}
        <div className="relative px-5 py-3 flex items-center justify-center shrink-0">
          <div className="flex flex-col items-center gap-1">
            <NavLink to="/dashboard" end onClick={cerrarSidebar}>
              <img
                src="/MasterLogo.png"
                alt="AppointVa"
                className={`object-contain rounded-lg transition-all duration-200 ${sidebarCollapsed ? "h-7" : "h-9"}`}
              />
            </NavLink>
            {!sidebarCollapsed && esEmpleado && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Empleado
              </span>
            )}
          </div>
          {/* Cerrar — solo móvil */}
          <button onClick={cerrarSidebar} className="absolute right-3 xl:hidden text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Botón colapsar — solo desktop, fila propia para no solapar el logo */}
        <div className={`hidden xl:flex shrink-0 px-3 pb-2 ${sidebarCollapsed ? "justify-center" : "justify-end"}`}>
          <button
            onClick={toggleCollapsed}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
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
                    isActive
                      ? "bg-slate-900 dark:bg-slate-600 text-white font-semibold shadow-md"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`
                }
                style={({ isActive }) =>
                  isActive && perfil?.sector === "salud"
                    ? { backgroundColor: "#1B6CA8" }
                    : undefined
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      sidebarCollapsed ? "w-11 h-11" : "w-7 h-7"
                    } ${isActive && !sidebarCollapsed ? "bg-white/20" : "bg-transparent"}`}>
                      <Icon size={sidebarCollapsed ? 22 : 15} className={isActive ? "text-white" : "text-slate-500 dark:text-slate-400"} />
                    </div>
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1 whitespace-nowrap">{item.label}</span>
                        {esCitas && hoyCnt > 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                            pendientesCnt > 0
                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-500"
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
              <Tooltip key={item.to} text={item.label} side="right">
                {/* span wrapper evita que asChild rompa el className-function de NavLink */}
                <span className="block">{link}</span>
              </Tooltip>
            ) : link;
          })}
        </nav>

        {/* Enlace de reservas */}
        {!esEmpleado && bookingUrl && (
          <div className={`p-3 border-t border-slate-100 dark:border-slate-700/50 shrink-0 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
            {sidebarCollapsed ? (
              <Tooltip text="Enlace de reservas" side="right">
                <span className="block">
                  <button
                    onClick={copiarEnlace}
                    className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition"
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
      </aside>

      {/* ── Columna derecha ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Barra superior móvil ── */}
        <header
          className="xl:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/50 px-4 py-3 flex items-center gap-3 shrink-0 z-30"
          style={perfil?.sector === "salud" ? { backgroundColor: "#1B6CA8" } : undefined}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <Menu size={18} />
          </button>
          <NavLink to="/dashboard" end>
            <img src="/MasterLogo.png" alt="AppointVa" className="h-7 object-contain rounded-lg" />
          </NavLink>
          {esEmpleado && (
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Empleado
            </span>
          )}
          <div ref={headerUserRef} className="ml-auto flex items-center gap-2 relative">
            <FechaHoraActual />
            {!esEmpleado && <NotificacionesBell />}
            {pendientesCnt > 0 && (
              <Tooltip text={`${pendientesCnt} cita${pendientesCnt !== 1 ? "s" : ""} pendiente${pendientesCnt !== 1 ? "s" : ""} por confirmar`}>
                <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-default">
                  {pendientesCnt > 9 ? "9+" : pendientesCnt} pendiente{pendientesCnt !== 1 ? "s" : ""}
                </span>
              </Tooltip>
            )}
            <button
              onClick={() => setHeaderMenuOpen((o) => !o)}
              className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden"
            >
              {usuario?.fotoUrl
                ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-[10px] font-bold text-white">{iniciales}</span>
              }
            </button>
            {headerMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden z-50">
                <UserMenuContent {...menuProps} />
              </div>
            )}
          </div>
        </header>

        {/* ── Banner cuenta inactiva ── */}
        {!esEmpleado && perfil && !perfil.activo && (
          <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Mail size={11} className="text-amber-600" />
            </div>
            <p className="text-xs text-amber-800 font-medium">
              Tu negocio está pendiente de activación.{" "}
              <a href="mailto:hola@appointva.com" className="underline font-semibold hover:text-amber-900 transition-colors">
                Escríbenos a hola@appointva.com
              </a>{" "}
              para habilitarlo.
            </p>
          </div>
        )}

        {/* ── Contenido principal ── */}
        <main className="flex-1 overflow-y-auto bg-white dark:bg-slate-950" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Desktop topbar — hidden on mobile (mobile has its own header) */}
          <header className="hidden xl:flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-900">
            <FechaHoraActual />
            {!esEmpleado && <NotificacionesBell />}
            <div ref={desktopUserRef} className="relative flex items-center">
              <button
                onClick={() => setHeaderMenuOpen((o) => !o)}
                className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden"
              >
                {usuario?.fotoUrl
                  ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  : <span className="text-[10px] font-bold text-white">{iniciales}</span>
                }
              </button>
              {headerMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden z-50">
                  <UserMenuContent {...menuProps} />
                </div>
              )}
            </div>
          </header>
          <Outlet />
        </main>

      </div>

      {encuestaEstado?.mostrar && !encuestaCerrada && (
        <EncuestaSatisfaccionModal onCerrar={() => setEncuestaCerrada(true)} />
      )}
    </div>
  );
}
