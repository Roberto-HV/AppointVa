import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, CalendarDays, Users, Scissors, UserCheck, Building2, Link, Copy, Check, BarChart2, ShieldCheck, UserCircle, Images, ClipboardList, Tag, LogOut, ChevronUp, Mail, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { negociosApi } from "../api/negocios";
import { citasApi, ESTADOS } from "../api/citas";
import { useToastStore } from "../store/toastStore";
import { Tooltip } from "../components/ui/Tooltip";

interface UserMenuContentProps {
  usuario: { fotoUrl?: string | null; nombreCompleto: string; email: string; rol: string } | null;
  perfil?: { planNombre?: string | null } | null;
  iniciales: string;
  rolChip: { label: string; cls: string };
  rol: string;
  onProfile: () => void;
  onLogout: () => void;
}

function UserMenuContent({ usuario, perfil, iniciales, rolChip, rol, onProfile, onLogout }: UserMenuContentProps) {
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
          <p className="text-sm font-semibold text-slate-800 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-slate-400 truncate">{usuario?.email}</p>
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
      <div className="h-px bg-slate-100 mx-3 my-1" />
      <button
        onClick={onProfile}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
      >
        <UserCircle size={15} className="text-slate-400 shrink-0" />
        Mi perfil
      </button>
      <a
        href={rol === "Empleado" ? "/manuales/manual-empleado.html" : "/manuales/manual-propietario.html"}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition"
      >
        <BookOpen size={15} className="text-slate-400 shrink-0" />
        Manual de usuario
      </a>
      <div className="h-px bg-slate-100 mx-3 my-1" />
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
      >
        <LogOut size={15} className="shrink-0" />
        Cerrar sesión
      </button>
      <div className="h-2" />
    </div>
  );
}

const NAV_PROPIETARIO = [
  { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
  { to: "/dashboard/citas", label: "Citas", icon: CalendarDays },
  { to: "/dashboard/empleados", label: "Empleados", icon: Users },
  { to: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { to: "/dashboard/clientes", label: "Clientes", icon: UserCheck },
  { to: "/dashboard/perfil", label: "Mi negocio", icon: Building2 },
  { to: "/dashboard/galeria", label: "Galería", icon: Images },
  // { to: "/dashboard/espera", label: "Lista de espera", icon: Clock },
  { to: "/dashboard/intake", label: "Cuestionario", icon: ClipboardList },
  { to: "/dashboard/descuentos", label: "Descuentos", icon: Tag },
  { to: "/dashboard/reportes", label: "Reportes", icon: BarChart2 },
  { to: "/dashboard/seguridad", label: "Seguridad", icon: ShieldCheck },
];

const NAV_EMPLEADO = [
  { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
  { to: "/dashboard/citas", label: "Mis citas", icon: CalendarDays },
  { to: "/dashboard/mi-perfil", label: "Mi perfil", icon: UserCircle },
];

export default function DashboardLayout() {
  const { usuario, refreshToken, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToastStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const prevPendientesRef = useRef<number | null>(null);
  const sidebarUserRef = useRef<HTMLDivElement>(null);
  const headerUserRef = useRef<HTMLDivElement>(null);

  const esEmpleado = usuario?.rol === "Empleado";
  const navItems = esEmpleado ? NAV_EMPLEADO : NAV_PROPIETARIO;

  const { data: perfil } = useQuery({
    queryKey: ["negocio-perfil-layout"],
    queryFn: negociosApi.obtenerPerfil,
    enabled: !esEmpleado,
    staleTime: 1000 * 60 * 5,
  });

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
    new Date(c.finEn) > ahora
  ).length;
  const pendientesCnt = citasHoy.filter((c) => c.estado === ESTADOS.Pendiente).length;

  useEffect(() => {
    if (prevPendientesRef.current !== null && pendientesCnt > prevPendientesRef.current) {
      const nuevas = pendientesCnt - prevPendientesRef.current;
      toast(`${nuevas} nueva${nuevas > 1 ? "s" : ""} cita${nuevas > 1 ? "s" : ""} pendiente${nuevas > 1 ? "s" : ""}`);
    }
    prevPendientesRef.current = pendientesCnt;
  }, [pendientesCnt, toast]);

  const bookingUrl = perfil ? `${window.location.origin}/b/${perfil.slug}` : "";
  const iniciales = (usuario?.nombreCompleto ?? "?")
    .split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();

  const copiarEnlace = () => {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      cerrarSesion();
      navigate("/login");
    }
  };

  const cerrarSidebar = () => {
    (document.activeElement as HTMLElement)?.blur();
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const fueraSidebar = !sidebarUserRef.current?.contains(target);
      const fueraHeader = !headerUserRef.current?.contains(target);
      if (fueraSidebar && fueraHeader) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

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
    onProfile: () => { navigate("/dashboard/mi-perfil"); setUserMenuOpen(false); cerrarSidebar(); },
    onLogout: () => { setUserMenuOpen(false); handleLogout(); },
  };

  // Resetea scroll al montar — iOS puede llegar con viewport desplazado por el teclado del login
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  return (
    <div className="h-lvh flex overflow-hidden bg-white">

      {/* ── Overlay backdrop (móvil) — siempre montado, fade vía inline style ── */}
      <div
        className="fixed inset-0 z-40 md:hidden transition-colors duration-200"
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
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col
          transition-transform duration-200 ease-in-out
          md:static md:w-60 md:translate-x-0 md:h-full md:shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + cerrar móvil */}
        <div
          className="relative px-5 py-3 border-b border-slate-100 flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-1">
            <NavLink to="/dashboard" end onClick={cerrarSidebar}>
              <img src="/MasterLogo.png" alt="AppointVa" className="h-9 object-contain" />
            </NavLink>
            {esEmpleado && (
              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                Empleado
              </span>
            )}
          </div>
          <button onClick={cerrarSidebar} className="absolute right-3 md:hidden text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const esCitas = item.to === "/dashboard/citas";
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={cerrarSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? "bg-white/15" : "bg-transparent"
                    }`}>
                      <Icon size={15} className={isActive ? "text-white" : "text-slate-500"} />
                    </div>
                    <span className="flex-1">{item.label}</span>
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
              </NavLink>
            );
          })}
        </nav>

        {/* Enlace de reservas — Klarna style */}
        {!esEmpleado && bookingUrl && (
          <div className="px-3 pb-3">
            <button
              onClick={copiarEnlace}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium bg-slate-50 hover:bg-slate-100 border border-slate-100 transition group"
            >
              <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                {copiado ? <Check size={12} className="text-emerald-500" /> : <Link size={12} className="text-slate-500" />}
              </div>
              <span className="flex-1 text-left text-slate-600 truncate">
                {copiado ? "¡Copiado!" : "Enlace de reservas"}
              </span>
              {!copiado && <Copy size={11} className="text-slate-300 group-hover:text-slate-400 transition shrink-0" />}
            </button>
          </div>
        )}

        {/* Usuario — popover hacia arriba */}
        <div ref={sidebarUserRef} className="relative p-3 border-t border-slate-100 shrink-0">
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-50">
              <UserMenuContent {...menuProps} />
            </div>
          )}
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition group"
          >
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
              {usuario?.fotoUrl
                ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-[11px] font-bold text-white">{iniciales}</span>
              }
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-slate-800 truncate">{usuario?.nombreCompleto}</p>
              <p className="text-[10px] text-slate-400 truncate">{usuario?.email}</p>
            </div>
            <ChevronUp
              size={13}
              className={`text-slate-300 group-hover:text-slate-400 transition-transform shrink-0 ${userMenuOpen ? "" : "rotate-180"}`}
            />
          </button>
        </div>
      </aside>

      {/* ── Columna derecha ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Barra superior móvil ── */}
        <header
          className="md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 shrink-0 z-30"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
          >
            <Menu size={18} />
          </button>
          <NavLink to="/dashboard" end>
            <img src="/MasterLogo.png" alt="AppointVa" className="h-7 object-contain" />
          </NavLink>
          {esEmpleado && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Empleado
            </span>
          )}
          <div ref={headerUserRef} className="ml-auto flex items-center gap-2 relative">
            {pendientesCnt > 0 && (
              <Tooltip text={`${pendientesCnt} cita${pendientesCnt !== 1 ? "s" : ""} pendiente${pendientesCnt !== 1 ? "s" : ""} por confirmar`}>
                <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-default">
                  {pendientesCnt > 9 ? "9+" : pendientesCnt} pendiente{pendientesCnt !== 1 ? "s" : ""}
                </span>
              </Tooltip>
            )}
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden"
            >
              {usuario?.fotoUrl
                ? <img src={usuario.fotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-[10px] font-bold text-white">{iniciales}</span>
              }
            </button>
            {userMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-50">
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
        <main className="flex-1 overflow-y-auto overscroll-y-none bg-white">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
