import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, ExternalLink } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";
import { useInactividadTimeout } from "../hooks/useInactividadTimeout";

export default function AdminLayout() {
  const { usuario, token, refreshToken, cerrarSesion } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      cerrarSesion();
      navigate("/login");
    }
  };

  useInactividadTimeout(handleLogout);

  const cerrarSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950">

      {/* ── Barra superior móvil ── */}
      <header className="md:hidden bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-30 shadow-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
        >
          <Menu size={22} />
        </button>
        <span className="font-bold text-gray-900 dark:text-white">
          Appoint<span className="text-[#C8A961]">Va</span>
        </span>
        <span className="text-xs bg-yellow-400 text-gray-900 font-bold px-2 py-0.5 rounded-full">
          Admin
        </span>
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
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col
          transition-transform duration-200 ease-in-out
          md:static md:w-60 md:translate-x-0 md:h-screen md:sticky md:top-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + cerrar */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Appoint<span className="text-[#C8A961]">Va</span>
            </span>
            <span className="hidden md:inline text-xs bg-yellow-400 text-gray-900 font-bold px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <button
            onClick={cerrarSidebar}
            className="md:hidden text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <NavLink
            to="/admin"
            end
            onClick={cerrarSidebar}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200"
              }`
            }
          >
            Negocios
          </NavLink>
          <NavLink
            to="/admin/audit"
            onClick={cerrarSidebar}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200"
              }`
            }
          >
            Audit Log
          </NavLink>
          <a
            href={`${import.meta.env.VITE_API_URL?.replace("/api", "")}/hangfire-session?token=${token}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={cerrarSidebar}
            className="block px-4 py-2.5 rounded-xl text-sm font-medium transition text-gray-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
          >
            Jobs <ExternalLink size={12} />
          </a>
        </nav>

        {/* Usuario */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-3">{usuario?.email}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
