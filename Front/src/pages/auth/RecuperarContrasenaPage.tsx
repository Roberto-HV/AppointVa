import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";

const schema = z.object({
  email: z.string().email("Correo inválido"),
});
type FormData = z.infer<typeof schema>;

export default function RecuperarContrasenaPage() {
  const [enviado, setEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await authApi.recuperarContrasena(data.email);
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/MasterLogo.png" alt="AppointVa" className="h-20 object-contain mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Panel de administración</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {enviado ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Revisa tu correo</h2>
              <p className="text-sm text-gray-500 mb-6">
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link to="/login" className="text-sm text-slate-700 hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">¿Olvidaste tu contraseña?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition
                      focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                      ${errors.email ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    placeholder="correo@ejemplo.com"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed
                    text-white font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  {isSubmitting ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
            </>
          )}
        </div>

        {!enviado && (
          <p className="text-center text-sm text-gray-500 mt-5">
            <Link to="/login" className="text-slate-700 hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
