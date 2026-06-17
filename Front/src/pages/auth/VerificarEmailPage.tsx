import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/axios";

type Estado = "cargando" | "ok" | "error";

export default function VerificarEmailPage() {
  const [searchParams] = useSearchParams();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const userId = searchParams.get("userId");
    const token = searchParams.get("token");

    if (!userId || !token) {
      setMensaje("El enlace de verificación es inválido.");
      setEstado("error");
      return;
    }

    api
      .get("/publico/verificar-email", { params: { userId, token } })
      .then((res) => {
        setMensaje(res.data?.mensaje ?? "¡Correo verificado!");
        setEstado("ok");
      })
      .catch((err) => {
        setMensaje(
          err?.response?.data?.mensaje ?? "El enlace de verificación es inválido o ha expirado."
        );
        setEstado("error");
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <img src="/MasterLogo.png" alt="AppointVa" className="h-20 object-contain mx-auto mb-6" />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {estado === "cargando" && (
            <>
              <div className="w-12 h-12 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Verificando tu correo...</p>
            </>
          )}

          {estado === "ok" && (
            <>
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Correo verificado!</h2>
              <p className="text-gray-500 text-sm mb-6">{mensaje}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition text-sm"
              >
                Iniciar sesión
              </Link>
            </>
          )}

          {estado === "error" && (
            <>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Enlace inválido</h2>
              <p className="text-gray-500 text-sm mb-6">{mensaje}</p>
              <Link
                to="/registro"
                className="inline-block w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition text-sm"
              >
                Volver al registro
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza Tu Negocio</p>
      </div>
    </div>
  );
}
