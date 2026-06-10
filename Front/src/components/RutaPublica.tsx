import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function RutaPublica() {
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);

  if (!token) return <Outlet />;

  // Redirige según rol
  if (usuario?.rol === "SuperAdmin") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}
