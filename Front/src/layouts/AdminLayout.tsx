import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, ExternalLink, Sun, Moon } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { adminApi } from "../api/admin";
import { useInactividadTimeout } from "../hooks/useInactividadTimeout";
import { useTheme } from "../hooks/useTheme";
import { useMediaQuery } from "../hooks/useMediaQuery";
import LogoMarca from "../components/LogoMarca";
import AvisoInactividad from "../components/AvisoInactividad";

/** Desde `md` el sidebar es fijo; por debajo es un cajón modal. */
const CONSULTA_ESCRITORIO = "(min-width: 768px)";

const ENLACE_NAV =
  "flex items-center gap-1 min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40";
const ENLACE_NAV_ACTIVO = "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
const ENLACE_NAV_INACTIVO =
  "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200";

const claseEnlaceNav = ({ isActive }: { isActive: boolean }) =>
  `${ENLACE_NAV} ${isActive ? ENLACE_NAV_ACTIVO : ENLACE_NAV_INACTIVO}`;

export default function AdminLayout() {
  const { usuario, refreshToken, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const [errorHangfire, setErrorHangfire] = useState<string | null>(null);

  // S2: the JWT never goes in a URL. The tab is opened synchronously (so the popup
  // blocker allows it) and pointed at /hangfire-session once the one-time ticket arrives.
  // If the popup is blocked, no ticket is requested and the admin tab stays put.
  const abrirHangfire = async () => {
    cerrarSidebar();
    setErrorHangfire(null);
    const ventana = window.open("about:blank", "_blank");
    if (!ventana) {
      setErrorHangfire("El navegador bloqueó la pestaña nueva. Permite las ventanas emergentes para este sitio e intenta de nuevo.");
      return;
    }
    ventana.opener = null;
    try {
      const ticket = await adminApi.emitirTicketHangfire();
      const base = import.meta.env.VITE_API_URL?.replace("/api", "") ?? "";
      ventana.location.replace(`${base}/hangfire-session?ticket=${encodeURIComponent(ticket)}`);
    } catch {
      ventana.close();
      setErrorHangfire("No se pudo abrir el panel de tareas. Intenta de nuevo.");
    }
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      cerrarSesion();
      navigate("/login");
    }
  };

  const inactividad = useInactividadTimeout(handleLogout);

  const esEscritorio = useMediaQuery(CONSULTA_ESCRITORIO);
  const sidebarRef = useRef<HTMLElement>(null);
  const botonMenuRef = useRef<HTMLButtonElement>(null);
  const botonCerrarRef = useRef<HTMLButtonElement>(null);

  // Mismo patrón que DashboardLayout: al cerrar el cajón, el foco vuelve al
  // botón que lo abrió.
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">

      {/* ── Barra superior móvil ── */}
      <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
        <button
          ref={botonMenuRef}
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir el menú"
          aria-expanded={sidebarOpen}
          aria-controls="menu-admin"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <span className="font-bold text-slate-900 dark:text-white">
          Appoint<span className="text-[#C8A961]">Va</span>
        </span>
        <span className="text-xs bg-yellow-400 text-slate-900 font-bold px-2 py-0.5 rounded-full">
          Admin
        </span>
        {/* El tema vivía solo en la cabecera de escritorio: en un teléfono no
            había forma de cambiarlo. */}
        <button
          onClick={toggle}
          aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="ml-auto min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
        >
          {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
      </header>

      {/* ── Overlay backdrop (móvil) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={cerrarSidebar}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        id="menu-admin"
        ref={sidebarRef}
        aria-label="Menú de administración"
        // Cerrado en móvil, el cajón está fuera de pantalla: `inert` saca sus
        // enlaces del orden de tabulación y del lector de pantalla.
        inert={!esEscritorio && !sidebarOpen}
        {...(!esEscritorio && sidebarOpen ? { role: "dialog", "aria-modal": true } : {})}
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col
          transition-transform duration-200 ease-in-out
          md:static md:w-60 md:translate-x-0 md:h-screen md:sticky md:top-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + cerrar */}
        <div className="px-5 py-5 flex items-center justify-between">
          <LogoMarca prioridad variante={theme === "dark" ? "oscuro" : "normal"} className="h-10 mx-auto" />
          <button
            ref={botonCerrarRef}
            onClick={cerrarSidebar}
            aria-label="Cerrar el menú"
            className="md:hidden min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Nav */}
        <nav aria-label="Secciones de administración" className="flex-1 py-4 px-3 space-y-1">
          <NavLink to="/admin" end onClick={cerrarSidebar} className={claseEnlaceNav}>
            Negocios
          </NavLink>
          <NavLink to="/admin/audit" onClick={cerrarSidebar} className={claseEnlaceNav}>
            Registro de auditoría
          </NavLink>
          <button
            type="button"
            onClick={abrirHangfire}
            className={`${ENLACE_NAV} ${ENLACE_NAV_INACTIVO} w-full text-left`}
          >
            Tareas programadas <ExternalLink size={12} aria-hidden="true" />
            <span className="sr-only"> (se abre en una pestaña nueva)</span>
          </button>
          {errorHangfire && (
            <p role="alert" className="px-4 text-xs text-red-600 dark:text-red-400">
              {errorHangfire}
            </p>
          )}
        </nav>

        {/* Usuario */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate mb-3">{usuario?.email}</p>
          <button
            onClick={handleLogout}
            className="min-h-[44px] lg:min-h-[36px] px-2 -mx-2 rounded-lg text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="hidden md:flex px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              Appoint<span className="text-[#C8A961]">Va</span>
            </span>
            <span className="text-xs bg-yellow-400 text-slate-900 font-bold px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40"
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          >
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      <AvisoInactividad abierto={inactividad.aviso} onSeguir={inactividad.seguir} onCerrarSesion={() => handleLogout()} />
    </div>
  );
}
