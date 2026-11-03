import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, ExternalLink, ShieldAlert } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { adminApi } from "../api/admin";
import { useInactividadTimeout } from "../hooks/useInactividadTimeout";
import { useTheme } from "../hooks/useTheme";
import { useMediaQuery } from "../hooks/useMediaQuery";
import LogoMarca from "../components/LogoMarca";
import AvisoInactividad from "../components/AvisoInactividad";
import MenuUsuarioAdmin from "./MenuUsuarioAdmin";
import { inicialesDe } from "../utils/iniciales";
import { RUTA_CUENTA_ADMIN, RUTA_FACTURACION_ADMIN, RUTA_NEGOCIOS_ADMIN, RUTA_SEGURIDAD_ADMIN } from "./rutasAdmin";
import { esPendienteActivacion } from "../utils/negociosAdmin";

/** Desde `md` el sidebar es fijo; por debajo es un cajón modal. */
const CONSULTA_ESCRITORIO = "(min-width: 768px)";

const ENLACE_NAV =
  "flex items-center gap-1 min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40 dark:focus-visible:ring-accent-brand/40";
const ENLACE_NAV_ACTIVO = "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400";
const ENLACE_NAV_INACTIVO =
  "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200";

/**
 * "Admin" junto a la marca (M1). Es parte de la marca, así que lleva su dorado
 * y no el `yellow-400` de antes, que no es de la paleta; el texto oscuro sobre
 * el dorado pasa de 7:1.
 */
const CHIP_ADMIN = "text-xs bg-[#C8A961] text-slate-900 font-bold px-2 py-0.5 rounded-full shrink-0";

const claseEnlaceNav = ({ isActive }: { isActive: boolean }) =>
  `${ENLACE_NAV} ${isActive ? ENLACE_NAV_ACTIVO : ENLACE_NAV_INACTIVO}`;

export default function AdminLayout() {
  const { usuario, refreshToken, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();

  // Menú de usuario: se abre desde el avatar de la barra móvil o de la de
  // escritorio; se guarda cuál para devolverle el foco y no duplicar el menú.
  const [menuUsuario, setMenuUsuario] = useState<null | "movil" | "escritorio">(null);
  const menuMovilRef = useRef<HTMLDivElement>(null);
  const menuEscritorioRef = useRef<HTMLDivElement>(null);
  const botonUsuarioMovilRef = useRef<HTMLButtonElement>(null);
  const botonUsuarioEscritorioRef = useRef<HTMLButtonElement>(null);

  // G1: la cuenta con más poder sin verificación en dos pasos se avisa en todas
  // las pantallas del admin hasta que la active (menos en la propia Seguridad).
  const { data: estado2FA } = useQuery({
    queryKey: ["2fa-estado"],
    queryFn: authApi.obtenerEstado2FA,
    staleTime: 1000 * 60,
  });
  const avisar2FA = estado2FA?.habilitado === false && pathname !== RUTA_SEGURIDAD_ADMIN;

  // I7: cuántas altas esperan activación, junto a "Negocios". Misma consulta (y
  // caché) que la lista, así que no cuesta una petición más.
  const { data: metricas } = useQuery({
    queryKey: ["admin-negocios-metricas"],
    queryFn: adminApi.obtenerMetricas,
    staleTime: 1000 * 60 * 2,
  });
  const pendientes = metricas?.filter(esPendienteActivacion).length ?? 0;

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

  // Mismo comportamiento que el menú de usuario del panel: se cierra al tocar o
  // enfocar fuera, y con Escape el foco vuelve al avatar.
  useEffect(() => {
    if (!menuUsuario) return;
    const contenedor = menuUsuario === "movil" ? menuMovilRef : menuEscritorioRef;
    const boton = menuUsuario === "movil" ? botonUsuarioMovilRef : botonUsuarioEscritorioRef;
    const fuera = (target: Node) => !contenedor.current?.contains(target);
    const onPointer = (e: PointerEvent) => { if (fuera(e.target as Node)) setMenuUsuario(null); };
    const onFocus = (e: FocusEvent) => { if (fuera(e.target as Node)) setMenuUsuario(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuUsuario(null);
      boton.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuUsuario]);

  const propsMenu = {
    usuario,
    theme,
    onAlternarTema: toggle,
    onCuenta: () => { setMenuUsuario(null); navigate(RUTA_CUENTA_ADMIN); },
    onSeguridad: () => { setMenuUsuario(null); navigate(RUTA_SEGURIDAD_ADMIN); },
    onCerrarSesion: () => { setMenuUsuario(null); handleLogout(); },
  };

  const avatar = (
    usuario?.fotoUrl
      ? <img src={usuario.fotoUrl} alt="" className="w-full h-full object-cover" />
      : <span className="text-[11px] font-bold text-white">{inicialesDe(usuario?.nombreCompleto)}</span>
  );

  const CLASE_DESPLEGABLE =
    "absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-2xl overflow-hidden z-50";

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
        <span className={CHIP_ADMIN}>Admin</span>
        {/* Menú de usuario (cuenta, seguridad, tema y salir), como en el panel.
            El tema está dentro: antes era un botón suelto en cada cabecera. */}
        <div ref={menuMovilRef} className="ml-auto -mr-2 relative">
          <button
            ref={botonUsuarioMovilRef}
            type="button"
            onClick={() => setMenuUsuario((m) => (m === "movil" ? null : "movil"))}
            aria-label="Menú de usuario"
            aria-expanded={menuUsuario === "movil"}
            aria-controls="menu-usuario-admin-movil"
            className="w-11 h-11 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
          >
            <span className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-600 dark:ring-1 dark:ring-white/25 flex items-center justify-center overflow-hidden">
              {avatar}
            </span>
          </button>
          {menuUsuario === "movil" && (
            <div id="menu-usuario-admin-movil" className={CLASE_DESPLEGABLE}>
              <MenuUsuarioAdmin {...propsMenu} />
            </div>
          )}
        </div>
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
        <div className="px-5 py-5 flex items-center justify-between gap-2">
          {/* Una sola marca en escritorio (M1): el logo con "Admin" al lado. La
              barra superior ya no la repite. */}
          <div className="flex items-center justify-center gap-2 flex-1 min-w-0">
            <LogoMarca prioridad variante={theme === "dark" ? "oscuro" : "normal"} className="h-10 min-w-0" />
            <span className={CHIP_ADMIN}>Admin</span>
          </div>
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
          {/* Activo también en la ficha de un negocio (/admin/negocios/:id). */}
          <NavLink
            to={RUTA_NEGOCIOS_ADMIN}
            end
            onClick={cerrarSidebar}
            className={({ isActive }) => claseEnlaceNav({ isActive: isActive || pathname.startsWith("/admin/negocios/") })}
          >
            Negocios
            {pendientes > 0 && (
              <>
                <span aria-hidden="true" className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[11px] font-bold tabular-nums inline-flex items-center justify-center">
                  {pendientes}
                </span>
                <span className="sr-only">{`, ${pendientes} ${pendientes === 1 ? "pendiente" : "pendientes"} de activación`}</span>
              </>
            )}
          </NavLink>
          <NavLink to={RUTA_FACTURACION_ADMIN} onClick={cerrarSidebar} className={claseEnlaceNav}>
            Facturación
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
          {/* El nombre lleva a Mi cuenta: en el cajón móvil es el camino más corto. */}
          <NavLink
            to={RUTA_CUENTA_ADMIN}
            onClick={cerrarSidebar}
            className="block -mx-2 px-2 py-1 mb-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
          >
            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{usuario?.nombreCompleto}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{usuario?.email}</span>
          </NavLink>
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
        {/* Como la barra del panel: solo el menú de usuario a la derecha. La
            marca ya está en el sidebar; repetirla costaba 68px de alto (M1). */}
        <div className="hidden md:flex px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 items-center justify-end shrink-0">
          <div ref={menuEscritorioRef} className="relative flex items-center">
            <button
              ref={botonUsuarioEscritorioRef}
              type="button"
              onClick={() => setMenuUsuario((m) => (m === "escritorio" ? null : "escritorio"))}
              aria-label="Menú de usuario"
              aria-expanded={menuUsuario === "escritorio"}
              aria-controls="menu-usuario-admin-escritorio"
              className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-600 dark:ring-1 dark:ring-white/25 flex items-center justify-center overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {avatar}
            </button>
            {menuUsuario === "escritorio" && (
              <div id="menu-usuario-admin-escritorio" className={CLASE_DESPLEGABLE}>
                <MenuUsuarioAdmin {...propsMenu} />
              </div>
            )}
          </div>
        </div>
        {avisar2FA && (
          <div
            role="status"
            className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <ShieldAlert size={16} className="text-amber-700 dark:text-amber-300 shrink-0" aria-hidden="true" />
            <p className="text-xs text-amber-800 dark:text-amber-200 flex-1 min-w-[12rem]">
              <span className="font-semibold">Activa la verificación en dos pasos.</span>{" "}
              Esta cuenta puede eliminar negocios y cambiar cobros: además de la contraseña, pide un código de tu teléfono al entrar.
            </p>
            <Link
              to={RUTA_SEGURIDAD_ADMIN}
              className="inline-flex items-center min-h-[44px] lg:min-h-[32px] px-3 rounded-lg text-xs font-semibold text-amber-900 dark:text-amber-100 underline underline-offset-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
            >
              Activar ahora
            </Link>
          </div>
        )}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      <AvisoInactividad abierto={inactividad.aviso} onSeguir={inactividad.seguir} onCerrarSesion={() => handleLogout()} />
    </div>
  );
}
