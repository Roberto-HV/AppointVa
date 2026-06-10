import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface Props {
  roles?: string[];
}

export default function RutaProtegida({ roles }: Props) {
  const { token, usuario } = useAuthStore();

  if (!token) return <Navigate to="/login" replace />;

  if (roles && usuario && !roles.includes(usuario.rol))
    return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
