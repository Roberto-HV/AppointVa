import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../../api/auth";

const schema = z
  .object({
    nuevaContrasena: z.string().min(6, "Mínimo 6 caracteres"),
    confirmar: z.string(),
  })
  .refine((v) => v.nuevaContrasena === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
type FormData = z.infer<typeof schema>;

export default function RestablecerContrasenaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await authApi.restablecerContrasena(email, token, data.nuevaContrasena);
      setExito(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
        "No se pudo restablecer la contraseña. El enlace puede haber expirado.";
      setError(msg);
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-red-500 font-medium mb-4">Enlace inválido o incompleto.</p>
          <Link to="/login" className="text-sm text-primary hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AppointVa</h1>
          <p className="text-gray-500 mt-1">Panel de administración</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {exito ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">¡Contraseña actualizada!</h2>
              <p className="text-sm text-gray-500 mb-6">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <Link
                to="/login"
                className="inline-block bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition"
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Nueva contraseña</h2>
              <p className="text-sm text-gray-500 mb-6">
                Crea una contraseña segura para tu cuenta.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                {/* Nueva contraseña */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarNueva ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("nuevaContrasena")}
                      className={`w-full px-4 py-2.5 pr-11 rounded-lg border text-sm outline-none transition
                        focus:ring-2 focus:ring-primary/40 focus:border-primary
                        ${errors.nuevaContrasena ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarNueva((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {mostrarNueva ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.nuevaContrasena && (
                    <p className="text-red-500 text-xs mt-1">{errors.nuevaContrasena.message}</p>
                  )}
                </div>

                {/* Confirmar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={mostrarConfirmar ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("confirmar")}
                      className={`w-full px-4 py-2.5 pr-11 rounded-lg border text-sm outline-none transition
                        focus:ring-2 focus:ring-primary/40 focus:border-primary
                        ${errors.confirmar ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      placeholder="Repite la contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmar((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmar && (
                    <p className="text-red-500 text-xs mt-1">{errors.confirmar.message}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed
                    text-white font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  {isSubmitting ? "Guardando..." : "Restablecer contraseña"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
