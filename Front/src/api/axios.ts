import axios from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Adjunta el token JWT a cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si recibe 401 (en endpoints protegidos), limpia la sesión y redirige al login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? "";
    const esEndpointAuth = url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/2fa");
    if (error.response?.status === 401 && !esEndpointAuth) {
      useAuthStore.getState().cerrarSesion();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
