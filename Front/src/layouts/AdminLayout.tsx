import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/auth";

export default function AdminLayout() {
  const { usuario, refreshToken, cerrarSesion } = useAuthStore();
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

  const cerrarSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">

      {/* ── Barra superior móvil ── */}
      <header className="md:hidden bg-gray-900 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-400 hover:text-white transition"
        >
          <Menu size={22} />
        </button>
        <span className="font-bold text-white">AppointVa</span>
        <span className="text-xs bg-yellow-400 text-gray-900 font-bold px-2 py-0.5 rounded-full">
          Admin
        </span>
      </header>

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
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-gray-100 flex flex-col
          transition-transform duration-200 ease-in-out
          md:static md:w-60 md:translate-x-0 md:h-screen md:sticky md:top-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo + cerrar */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">AppointVa</span>
            <span className="hidden md:inline text-xs bg-yellow-400 text-gray-900 font-bold px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
          <button
            onClick={cerrarSidebar}
            className="md:hidden text-gray-400 hover:text-white"
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
              `block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            Negocios
          </NavLink>
          <NavLink
            to="/admin/audit"
            onClick={cerrarSidebar}
            className={({ isActive }) =>
              `block px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            Audit Log
          </NavLink>
        </nav>

        {/* Usuario */}
        <div className="p-4 border-t border-gray-700">
          <p className="text-xs font-medium text-gray-200 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-gray-500 truncate mb-3">{usuario?.email}</p>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-red-400 transition"
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
