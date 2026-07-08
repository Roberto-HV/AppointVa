import { useState, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function RutaPublica() {
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);

  // Esperar hidratación para evitar flash de login form en usuarios ya autenticados
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, [hydrated]);

  // Mientras hidrata: mostrar null (rutas públicas son rápidas, no necesitan spinner)
  if (!hydrated) return null;

  if (!token) return <Outlet />;

  if (usuario?.rol === "SuperAdmin") return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}
