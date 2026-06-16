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

  const colorActivo = perfil?.colorPrimario ?? "#C8A961";
  const bookingUrl = perfil ? `${window.location.origin}/b/${perfil.slug}` : "";

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
    <div className="h-screen flex overflow-hidden bg-gray-50">

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
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col
          transition-transform duration-200 ease-in-out
          md:static md:w-60 md:translate-x-0 md:h-full md:shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo (desktop) + cerrar (móvil) */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/MasterLogo.png" alt="AppointVa" className="h-9 object-contain" />
            {esEmpleado && (
              <span className="hidden md:inline text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
                Empleado
              </span>
            )}
          </div>
          <button
            onClick={cerrarSidebar}
            className="md:hidden text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
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
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive ? "text-white" : "text-gray-600 hover:bg-gray-100"
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: colorActivo } : {}
                }
              >
                <Icon size={17} className="shrink-0" />
                <span className="flex-1">{item.label}</span>
                {esCitas && hoyCnt > 0 && (
                  <span className={`text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none ${pendientesCnt > 0 ? "bg-red-500" : "bg-primary"}`}>
                    {hoyCnt > 9 ? "9+" : hoyCnt}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Enlace de reservas (solo propietario) */}
        {!esEmpleado && bookingUrl && (
          <div className="px-3 pb-3">
            <button
              onClick={copiarEnlace}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-50 border border-gray-100 transition"
            >
              {copiado ? <Check size={14} className="text-green-500 shrink-0" /> : <Link size={14} className="shrink-0" />}
              <span className="flex-1 text-left truncate">{copiado ? "¡Enlace copiado!" : "Copiar enlace de reservas"}</span>
              {!copiado && <Copy size={12} className="shrink-0 text-gray-400" />}
            </button>
          </div>
        )}

        {/* Usuario + logout */}
        <div className="p-4 border-t border-gray-100 shrink-0">
          <p className="text-xs font-medium text-gray-800 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-gray-400 truncate mb-3">{usuario?.email}</p>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold text-red-500 hover:text-red-600 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Columna derecha: header móvil + contenido ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* ── Barra superior móvil ── */}
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 transition"
          >
            <Menu size={22} />
          </button>
          <img src="/MasterLogo.png" alt="AppointVa" className="h-7 object-contain" />
          {esEmpleado && (
            <span className="text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
              Empleado
            </span>
          )}
          {/* Badge móvil */}
          {pendientesCnt > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {pendientesCnt > 9 ? "9+" : pendientesCnt}
            </span>
          )}
        </header>

        {/* ── Contenido principal ── */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>
    </div>
  );
}
