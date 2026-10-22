import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import LogoMarca from "../../components/LogoMarca";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { api, MOTIVO_RECEPCION_VENCIDA } from "../../api/axios";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import { useToastStore } from "../../store/toastStore";
import { quedanPocosCodigos } from "../../utils/codigosRecuperacion";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  contrasena: z.string().min(1, "La contraseña es requerida"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  useTituloPagina("Iniciar sesión");
  const navigate = useNavigate();
  const location = useLocation();
  const iniciarSesion = useAuthStore((s) => s.iniciarSesion);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const locationState = location.state as { registroExitoso?: boolean; returnUrl?: string } | null;
  const registroExitoso = locationState?.registroExitoso ?? false;
  const returnUrl = locationState?.returnUrl;
  const [searchParams] = useSearchParams();
  const recepcionVencida = searchParams.get("motivo") === MOTIVO_RECEPCION_VENCIDA;
  const [emailNoVerificado, setEmailNoVerificado] = useState<string | null>(null);
  const [reenvioEnviado, setReenvioEnviado] = useState(false);
  const [reenvioEnviando, setReenvioEnviando] = useState(false);

  // Estado del flujo 2FA
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [codigo2FA, setCodigo2FA] = useState("");
  const [verificando, setVerificando] = useState(false);
  // B8: el segundo paso también acepta un código de recuperación de un solo uso.
  const [usarRecuperacion, setUsarRecuperacion] = useState(false);
  const [codigoRecuperacion, setCodigoRecuperacion] = useState("");
  const { toast } = useToastStore();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setErrorGeneral("");
    setEmailNoVerificado(null);
    setReenvioEnviado(false);
    try {
      const respuesta = await authApi.login(data.email, data.contrasena);
      if (respuesta.requiere2FA && respuesta.challengeToken) {
        setChallengeToken(respuesta.challengeToken);
        return;
      }
      iniciarSesion(respuesta.token, respuesta.refreshToken, respuesta.usuario);
      (document.activeElement as HTMLElement)?.blur();
      if (respuesta.usuario.rol === "SuperAdmin") navigate("/admin");
      else navigate(returnUrl ?? "/dashboard");
    } catch (err: unknown) {
      const codigoError = (err as { response?: { data?: { codigoError?: string } } })?.response?.data?.codigoError;
      if (codigoError === "EMAIL_NO_VERIFICADO") {
        setEmailNoVerificado(data.email);
        return;
      }
      const mensaje =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "Error al iniciar sesión. Verifica tus credenciales.";
      setErrorGeneral(mensaje);
    }
  };

  const reenviarVerificacion = async () => {
    if (!emailNoVerificado || reenvioEnviando || reenvioEnviado) return;
    setReenvioEnviando(true);
    try {
      await api.post("/publico/reenviar-verificacion", { email: emailNoVerificado });
      setReenvioEnviado(true);
    } catch {
      setErrorGeneral("No se pudo reenviar el correo. Intenta de nuevo.");
    } finally {
      setReenvioEnviando(false);
    }
  };

  const onVerificar2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = usarRecuperacion ? codigoRecuperacion.trim() : codigo2FA.trim();
    if (!challengeToken || !valor) return;
    setErrorGeneral("");
    setVerificando(true);
    try {
      const respuesta = usarRecuperacion
        ? await authApi.verificar2FAConCodigoRecuperacion(challengeToken, valor)
        : await authApi.verificar2FA(challengeToken, valor);
      iniciarSesion(respuesta.token, respuesta.refreshToken, respuesta.usuario);
      const restantes = respuesta.codigosRecuperacionRestantes;
      if (usarRecuperacion && typeof restantes === "number") {
        toast(
          quedanPocosCodigos(restantes)
            ? `Te ${restantes === 1 ? "queda 1 código" : `quedan ${restantes} códigos`} de recuperación. Genera nuevos en Seguridad.`
            : `Entraste con un código de recuperación. Te quedan ${restantes}.`,
          quedanPocosCodigos(restantes) ? "error" : "info",
        );
      }
      (document.activeElement as HTMLElement)?.blur();
      if (respuesta.usuario.rol === "SuperAdmin") navigate("/admin");
      else navigate(returnUrl ?? "/dashboard");
    } catch (err: unknown) {
      const mensaje =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje
        ?? "Código incorrecto o expirado.";
      setErrorGeneral(mensaje);
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — formulario ── */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white px-8 py-12 sm:px-12 relative overflow-hidden">
        {/* Decoración mobile — oculta en desktop donde el panel derecho ya tiene los elementos */}
        <div className="absolute -top-16 -right-16 w-52 h-52 bg-slate-100/80 rounded-full md:hidden" aria-hidden="true" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-slate-100/80 rounded-full md:hidden" aria-hidden="true" />
        <div className="absolute top-1/3 -right-8 w-20 h-20 bg-slate-50 rounded-full md:hidden" aria-hidden="true" />

        <div className="w-full max-w-sm relative z-10">

          {/* Logo — centrado en mobile, izquierda en desktop */}
          <div className="mb-10 flex justify-center">
            <LogoMarca prioridad className="h-20 md:h-24 rounded-xl" />
          </div>

          {/* Alertas */}
          {registroExitoso && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5">
              ¡Cuenta creada! Revisa tu correo para verificar tu cuenta.
            </div>
          )}
          {recepcionVencida && (
            <div role="status" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
              <p className="text-amber-800 text-sm font-medium mb-1">Sesión de recepción vencida</p>
              <p className="text-amber-700 text-sm">
                El modo recepción se cerró porque su sesión venció o la cuenta cambió (por ejemplo, la contraseña).
                Inicia sesión para volver a abrirlo.
              </p>
            </div>
          )}
          {emailNoVerificado && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 mb-5">
              <p className="text-amber-800 text-sm font-medium mb-1">Correo no verificado</p>
              <p className="text-amber-700 text-sm mb-3">
                Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.
              </p>
              {reenvioEnviado ? (
                <p className="text-green-700 text-sm font-medium">¡Correo reenviado!</p>
              ) : (
                <button
                  onClick={reenviarVerificacion}
                  disabled={reenvioEnviando}
                  className="text-sm text-amber-800 font-semibold hover:underline disabled:opacity-50"
                >
                  {reenvioEnviando ? "Enviando..." : "Reenviar correo de verificación"}
                </button>
              )}
            </div>
          )}

          {challengeToken ? (
            /* ── Paso 2FA ── */
            <>
              <div className="mb-6">
                <div className="w-12 h-12 bg-slate-700/10 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Verificación en dos pasos</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {usarRecuperacion
                    ? "Ingresa uno de tus códigos de recuperación. Cada código sirve una sola vez."
                    : "Ingresa el código de 6 dígitos de tu app autenticadora"}
                </p>
              </div>
              <form onSubmit={onVerificar2FA} className="space-y-4">
                {usarRecuperacion ? (
                  <input
                    key="recuperacion"
                    type="text"
                    aria-label="Código de recuperación"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={20}
                    value={codigoRecuperacion}
                    onChange={(e) => setCodigoRecuperacion(e.target.value.toUpperCase())}
                    placeholder="XXXXX-XXXXX"
                    className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent-brand/30 focus:border-accent-brand"
                    autoFocus
                  />
                ) : (
                  <input
                    key="totp"
                    type="text"
                    aria-label="Código de verificación"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={codigo2FA}
                    onChange={(e) => setCodigo2FA(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-accent-brand/30 focus:border-accent-brand"
                    autoFocus
                  />
                )}
                {errorGeneral && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    {errorGeneral}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={verificando || (usarRecuperacion
                    ? codigoRecuperacion.replace(/[^0-9A-Z]/gi, "").length < 10
                    : codigo2FA.length < 6)}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
                >
                  {verificando ? "Verificando..." : "Verificar"}
                </button>
                <button
                  type="button"
                  onClick={() => { setUsarRecuperacion((v) => !v); setErrorGeneral(""); }}
                  className="w-full text-sm font-medium text-slate-600 hover:text-slate-800 underline-offset-2 hover:underline transition"
                >
                  {usarRecuperacion ? "Usar el código de la app" : "Usar un código de recuperación"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChallengeToken(null); setCodigo2FA(""); setCodigoRecuperacion("");
                    setUsarRecuperacion(false); setErrorGeneral("");
                  }}
                  className="w-full text-sm text-slate-400 hover:text-slate-600 transition"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>
            </>
          ) : (
            /* ── Login normal ── */
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Inicia sesión</h1>
              <p className="text-sm text-slate-500 mb-8">Ingresa tus datos para continuar</p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition
                      focus:ring-2 focus:ring-accent-brand/30 focus:border-accent-brand
                      ${errors.email ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                    placeholder="correo@ejemplo.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-slate-700">Contraseña</label>
                    <Link to="/recuperar-contrasena" className="text-xs text-slate-600 hover:underline">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      autoComplete="current-password"
                      {...register("contrasena")}
                      className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none transition
                        focus:ring-2 focus:ring-accent-brand/30 focus:border-accent-brand
                        ${errors.contrasena ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setMostrarPassword((v) => !v); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                      tabIndex={-1}
                    >
                      {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.contrasena && <p className="text-red-500 text-xs mt-1">{errors.contrasena.message}</p>}
                </div>

                {errorGeneral && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    {errorGeneral}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
                >
                  {isSubmitting ? "Entrando..." : "Iniciar sesión"}
                </button>
              </form>

              {/* Link registro — solo mobile (md oculta porque está en el panel derecho) */}
              <p className="text-center text-sm text-slate-500 mt-6 md:hidden">
                ¿No tienes cuenta?{" "}
                <Link to="/registro" className="text-slate-700 hover:underline font-medium">
                  Registra tu negocio
                </Link>
              </p>
            </>
          )}

          <p className="text-xs text-slate-400 mt-10 space-x-2 text-center">
            <Link to="/privacidad" className="hover:underline hover:text-slate-600 transition">Privacidad</Link>
            <span>·</span>
            <Link to="/terminos" className="hover:underline hover:text-slate-600 transition">Términos</Link>
          </p>
        </div>
      </div>

      {/* ── Panel derecho — branding (solo md+) ── */}
      <div className="hidden md:flex md:w-[45%] lg:w-2/5 bg-ink flex-col items-center justify-center relative overflow-hidden p-12">
        {/* Contenido central */}
        <div className="relative z-10 w-full max-w-xs text-center">
          <h2 className="text-3xl font-bold text-white mb-3">¿Nuevo por aquí?</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Registra tu negocio y configura servicios y horarios mientras lo activamos, en menos de 24 horas hábiles.
          </p>

          <Link
            to="/registro"
            className="inline-block w-full border-2 border-white text-white font-semibold py-3 rounded-xl hover:bg-white hover:text-slate-900 transition text-sm"
          >
            Registra tu negocio
          </Link>
        </div>

        <p className="absolute bottom-6 text-slate-400 text-xs">© {new Date().getFullYear()} AppointVa</p>
      </div>

    </div>
  );
}
