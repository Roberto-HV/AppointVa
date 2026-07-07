import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface Props {
  roles?: string[];
}

export default function RutaProtegida({ roles }: Props) {
  const { token, usuario, _hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!_hasHydrated) return null;

  if (!token) return <Navigate to="/login" state={{ returnUrl: location.pathname }} replace />;

  if (roles && !roles.includes(usuario?.rol ?? ""))
    return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
