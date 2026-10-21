import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../../api/auth";
import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import ReglasContrasena from "../../components/ReglasContrasena";
import LogoMarca from "../../components/LogoMarca";
import { esquemaContrasena } from "../../utils/contrasena";
import { mensajeError } from "../../utils/errores";
import { useTituloPagina } from "../../hooks/useTituloPagina";

/**
 * Enlace a /recuperar-contrasena con el correo ya escrito (AP-14). El correo
 * viaja en el estado de navegación, no en la URL.
 */
function NuevoEnlace({ email }: { email: string }) {
  return (
    <Link
      to="/recuperar-contrasena"
      state={email ? { email } : undefined}
      className="inline-flex items-center justify-center min-h-[44px] text-sm font-medium text-slate-700 hover:underline"
    >
      Solicitar un nuevo enlace
    </Link>
  );
}

const schema = z
  .object({
    nuevaContrasena: esquemaContrasena,
    confirmar: z.string(),
  })
  .refine((v) => v.nuevaContrasena === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
type FormData = z.infer<typeof schema>;

export default function RestablecerContrasenaPage() {
  useTituloPagina("Nueva contraseña");
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const nuevaValor = watch("nuevaContrasena", "");

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await authApi.restablecerContrasena(email, token, data.nuevaContrasena);
      setExito(true);
    } catch (err: unknown) {
      setError(mensajeError(err, "No se pudo restablecer la contraseña. El enlace puede haber expirado."));
    }
  };

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <h1 className="text-lg font-semibold text-gray-800 mb-2">Enlace inválido o incompleto</h1>
          <p className="text-sm text-gray-500 mb-4">Los enlaces para restablecer la contraseña vencen. Pide uno nuevo con tu correo.</p>
          <div className="flex flex-col items-center gap-1">
            <NuevoEnlace email={email} />
            <Link to="/login" className="inline-flex items-center min-h-[44px] text-sm text-gray-600 hover:underline">Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoMarca prioridad className="h-20 mx-auto" />
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
                className="inline-block bg-slate-700 hover:bg-slate-800 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition"
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
                        focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                        ${errors.nuevaContrasena ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      aria-describedby="reglas-nueva-contrasena"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
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
                  <ReglasContrasena id="reglas-nueva-contrasena" valor={nuevaValor ?? ""} />
                  <PasswordStrengthBar password={nuevaValor} />
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
                        focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                        ${errors.confirmar ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      placeholder="Repite la contraseña"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
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
                  <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                    <p>{error}</p>
                    <NuevoEnlace email={email} />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed
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
