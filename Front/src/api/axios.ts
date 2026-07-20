import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
});

// Cola de requests que fallaron por 401 mientras se estaba refrescando el token
let refrescando = false;
let cola: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const procesarCola = (error: unknown, nuevoToken: string | null) => {
  cola.forEach(({ resolve, reject }) => {
    if (error || !nuevoToken) reject(error);
    else resolve(nuevoToken);
  });
  cola = [];
};

// Adjunta el token JWT a cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor de respuesta: intenta refresh antes de cerrar sesión
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url: string = config?.url ?? "";
    const esEndpointAuth =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/2fa") ||
      url.includes("/auth/logout");

    if (error.response?.status !== 401 || esEndpointAuth || config._retry) {
      return Promise.reject(error);
    }

    // Si ya hay un refresh en curso, encolar esta request y esperar
    if (refrescando) {
      return new Promise<string>((resolve, reject) => {
        cola.push({ resolve, reject });
      }).then((token) => {
        config.headers.Authorization = `Bearer ${token}`;
        return api(config);
      });
    }

    config._retry = true;
    refrescando = true;

    const { refreshToken, iniciarSesion, cerrarSesion } = useAuthStore.getState();

    if (!refreshToken) {
      refrescando = false;
      cerrarSesion();
      window.location.href = "/login";
      return Promise.reject(error);
    }

    try {
      // Usar axios directo (sin interceptores) para el refresh
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );

      iniciarSesion(data.token, data.refreshToken, data.usuario);
      procesarCola(null, data.token);

      config.headers.Authorization = `Bearer ${data.token}`;
      return api(config);
    } catch (refreshError) {
      procesarCola(refreshError, null);
      cerrarSesion();
      window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      refrescando = false;
    }
  }
);
