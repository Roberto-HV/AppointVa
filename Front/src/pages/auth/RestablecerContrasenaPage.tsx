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
import { BOTON_PRIMARIO_AUTH, FONDO_AUTH, TARJETA_AUTH, TITULO_AUTH, campoAuth } from "../../lib/clasesAuth";
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
      <div className={FONDO_AUTH}>
        <div className={`w-full max-w-md text-center ${TARJETA_AUTH}`}>
          <h1 className={TITULO_AUTH}>Enlace inválido o incompleto</h1>
          <p className="text-sm text-slate-500 mb-4">Los enlaces para restablecer la contraseña vencen. Pide uno nuevo con tu correo.</p>
          <div className="flex flex-col items-center gap-1">
            <NuevoEnlace email={email} />
            <Link to="/login" className="inline-flex items-center min-h-[44px] text-sm text-slate-600 hover:underline">Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={FONDO_AUTH}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoMarca prioridad className="h-20 mx-auto" />
        </div>

        <div className={TARJETA_AUTH}>
          {exito ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className={TITULO_AUTH}>¡Contraseña actualizada!</h1>
              <p className="text-sm text-slate-500 mb-6">
                Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <Link
                to="/login"
                className={`inline-flex items-center justify-center ${BOTON_PRIMARIO_AUTH}`}
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h1 className={TITULO_AUTH}>Nueva contraseña</h1>
              <p className="text-sm text-slate-500 mb-6">
                Crea una contraseña segura para tu cuenta.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                {/* Nueva contraseña */}
                <div>
                  <label htmlFor="nueva-contrasena" className="block text-sm font-medium text-slate-700 mb-1">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="nueva-contrasena"
                      type={mostrarNueva ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("nuevaContrasena")}
                      className={`${campoAuth(!!errors.nuevaContrasena)} pr-12`}
                      aria-invalid={errors.nuevaContrasena ? true : undefined}
                      aria-describedby="reglas-nueva-contrasena"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setMostrarNueva((v) => !v)}
                      aria-label={mostrarNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={mostrarNueva}
                      className="absolute right-0 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
                    >
                      {mostrarNueva ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.nuevaContrasena && (
                    <p className="text-red-600 text-xs mt-1">{errors.nuevaContrasena.message}</p>
                  )}
                  <ReglasContrasena id="reglas-nueva-contrasena" valor={nuevaValor ?? ""} />
                  <PasswordStrengthBar password={nuevaValor} />
                </div>

                {/* Confirmar */}
                <div>
                  <label htmlFor="confirmar-contrasena" className="block text-sm font-medium text-slate-700 mb-1">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="confirmar-contrasena"
                      type={mostrarConfirmar ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("confirmar")}
                      className={`${campoAuth(!!errors.confirmar)} pr-12`}
                      aria-invalid={errors.confirmar ? true : undefined}
                      aria-describedby={errors.confirmar ? "confirmar-contrasena-error" : undefined}
                      placeholder="Repite la contraseña"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setMostrarConfirmar((v) => !v)}
                      aria-label={mostrarConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
                      aria-pressed={mostrarConfirmar}
                      className="absolute right-0 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand/40"
                    >
                      {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmar && (
                    <p id="confirmar-contrasena-error" className="text-red-600 text-xs mt-1">{errors.confirmar.message}</p>
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
                  className={BOTON_PRIMARIO_AUTH}
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
