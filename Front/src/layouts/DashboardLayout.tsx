import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, LayoutDashboard, CalendarDays, Users, Scissors, UserCheck, Building2, Link, Copy, Check, BarChart2, ShieldCheck, UserCircle, Images, Clock, ClipboardList, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { negociosApi } from "../api/negocios";
import { citasApi, ESTADOS } from "../api/citas";
import { useToastStore } from "../store/toastStore";

const NAV_PROPIETARIO = [
  { to: "/dashboard", label: "Inicio", end: true, icon: LayoutDashboard },
  { to: "/dashboard/citas", label: "Citas", icon: CalendarDays },
  { to: "/dashboard/empleados", label: "Empleados", icon: Users },
  { to: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { to: "/dashboard/clientes", label: "Clientes", icon: UserCheck },
  { to: "/dashboard/perfil", label: "Mi negocio", icon: Building2 },
  { to: "/dashboard/galeria", label: "Galería", icon: Images },
  { to: "/dashboard/espera", label: "Lista de espera", icon: Clock },
  { to: "/dashboard/intake", label: "Formulario", icon: ClipboardList },
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
  const prevPendientesRef = useRef<number | null>(null);

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
  const hoyCnt = citasHoy.length;
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

  const cerrarSidebar = () => setSidebarOpen(false);

  return (
    <div className="h-dvh flex overflow-hidden bg-white">

      {/* ── Overlay backdrop (móvil) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={cerrarSidebar}
        />
      )}

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
        <div className="relative px-5 py-3 border-b border-slate-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <img src="/MasterLogo.png" alt="AppointVa" className="h-9 object-contain" />
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
                      <span className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${
                        pendientesCnt > 0 ? "bg-red-500" : "bg-slate-500"
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

        {/* Usuario con avatar de iniciales — Apple Store / Cash App style */}
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-white">{iniciales}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{usuario?.nombreCompleto}</p>
              <p className="text-[10px] text-slate-400 truncate">{usuario?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 w-full text-left text-xs font-medium text-red-400 hover:text-red-500 transition pl-[44px]"
          >
            Cerrar sesión
          </button>
          <p className="mt-3 text-[10px] text-slate-300 text-center select-none">
            AppointVa © {new Date().getFullYear()}
          </p>
        </div>
      </aside>

      {/* ── Columna derecha ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Barra superior móvil ── */}
        <header className="md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
          >
            <Menu size={18} />
          </button>
          <img src="/MasterLogo.png" alt="AppointVa" className="h-7 object-contain" />
          {esEmpleado && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Empleado
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {pendientesCnt > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendientesCnt > 9 ? "9+" : pendientesCnt}
              </span>
            )}
            <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{iniciales}</span>
            </div>
          </div>
        </header>

        {/* ── Contenido principal ── */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
