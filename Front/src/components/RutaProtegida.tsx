import { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { PageLoader } from "./ui/Skeleton";

interface Props {
  roles?: string[];
}

export default function RutaProtegida({ roles }: Props) {
  const { token, usuario } = useAuthStore();
  const location = useLocation();

  // Zustand v5: usar persist API en lugar de onRehydrateStorage (roto en v5)
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  if (!hydrated) return <PageLoader />;

  if (!token) return <Navigate to="/login" state={{ returnUrl: location.pathname }} replace />;

  if (roles && !roles.includes(usuario?.rol ?? "")) {
    // Redirige a la home correcta según rol — evita loops infinitos
    if (usuario?.rol === "SuperAdmin") return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
