import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { PageLoader } from "./ui/Skeleton";

interface Props {
  roles?: string[];
}

export default function RutaProtegida({ roles }: Props) {
  const { token, usuario, _hasHydrated } = useAuthStore();
  const location = useLocation();

  // Muestra loader mientras Zustand hidrata desde localStorage — evita la pantalla en blanco
  if (!_hasHydrated) return <PageLoader />;

  if (!token) return <Navigate to="/login" state={{ returnUrl: location.pathname }} replace />;

  if (roles && !roles.includes(usuario?.rol ?? "")) {
    // Redirige a la home correcta según rol — evita loops infinitos cuando un rol
    // navega a una ruta que no le corresponde
    if (usuario?.rol === "SuperAdmin") return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
