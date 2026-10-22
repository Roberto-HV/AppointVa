import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useTituloPagina } from "../hooks/useTituloPagina";
import { useVolverAtras } from "../hooks/useVolverAtras";

export default function NotFoundPage() {
  useTituloPagina("Página no encontrada");
  const navigate = useNavigate();
  // Sin historial (la 404 es la primera página de la pestaña) "Volver" no
  // tendría a dónde ir: solo queda "Ir al inicio" (AP-27).
  const { volver, hayHistorial } = useVolverAtras();
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="text-8xl font-bold text-slate-200 mb-2 select-none" aria-hidden="true">404</p>
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-primary" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-slate-500 text-sm mb-8">
          La dirección que buscas no existe o fue movida.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {hayHistorial && (
            <button
              type="button"
              onClick={volver}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 min-h-[44px] px-6 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Volver
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!token) navigate("/");
              else if (usuario?.rol === "SuperAdmin") navigate("/admin");
              else navigate("/dashboard");
            }}
            className="w-full sm:w-auto min-h-[44px] px-6 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold transition"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
