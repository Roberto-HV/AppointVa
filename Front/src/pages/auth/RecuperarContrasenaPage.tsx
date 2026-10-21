import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "react-router-dom";
import LogoMarca from "../../components/LogoMarca";
import { BOTON_PRIMARIO_AUTH, FONDO_AUTH, TARJETA_AUTH, TITULO_AUTH, campoAuth } from "../../lib/clasesAuth";
import { authApi } from "../../api/auth";
import { useTituloPagina } from "../../hooks/useTituloPagina";

const schema = z.object({
  email: z.string().email("Correo inválido"),
});
type FormData = z.infer<typeof schema>;

export default function RecuperarContrasenaPage() {
  useTituloPagina("Recuperar contraseña");
  const [enviado, setEnviado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  // Viene de un enlace de restablecimiento vencido (AP-14): el correo ya se conoce.
  const emailPrevio = (useLocation().state as { email?: unknown } | null)?.email;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: typeof emailPrevio === "string" ? emailPrevio : "" },
  });

  const onSubmit = async (data: FormData) => {
    setErrorGeneral(null);
    try {
      await authApi.recuperarContrasena(data.email);
      setEnviado(true);
    } catch {
      setErrorGeneral("No se pudo procesar tu solicitud. Intenta de nuevo.");
    }
  };

  return (
    <div className={FONDO_AUTH}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <LogoMarca prioridad className="h-20 mx-auto" />
        </div>

        <div className={TARJETA_AUTH}>
          {enviado ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className={TITULO_AUTH}>Revisa tu correo</h1>
              <p className="text-sm text-slate-500 mb-6">
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </p>
              <Link to="/login" className="text-sm text-slate-700 hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h1 className={TITULO_AUTH}>¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-slate-500 mb-6">
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div>
                  <label htmlFor="recuperar-email" className="block text-sm font-medium text-slate-700 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="recuperar-email"
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? "recuperar-email-error" : undefined}
                    className={campoAuth(!!errors.email)}
                    placeholder="correo@ejemplo.com"
                  />
                  {errors.email && (
                    <p id="recuperar-email-error" className="text-red-600 text-xs mt-1">{errors.email.message}</p>
                  )}
                </div>

                {errorGeneral && (
                  <p role="alert" className="text-red-600 text-sm text-center -mt-2">{errorGeneral}</p>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={BOTON_PRIMARIO_AUTH}
                >
                  {isSubmitting ? "Enviando..." : "Enviar enlace"}
                </button>
              </form>
            </>
          )}
        </div>

        {!enviado && (
          <p className="text-center text-sm text-slate-500 mt-5">
            <Link to="/login" className="text-slate-700 hover:underline">
              Volver al inicio de sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
