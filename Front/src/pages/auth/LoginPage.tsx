import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../api/axios";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  contrasena: z.string().min(1, "La contraseña es requerida"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const iniciarSesion = useAuthStore((s) => s.iniciarSesion);
  const [errorGeneral, setErrorGeneral] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const registroExitoso = (location.state as { registroExitoso?: boolean })?.registroExitoso ?? false;
  const [emailNoVerificado, setEmailNoVerificado] = useState<string | null>(null);
  const [reenvioEnviado, setReenvioEnviado] = useState(false);
  const [reenvioEnviando, setReenvioEnviando] = useState(false);

  // Estado del flujo 2FA
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [codigo2FA, setCodigo2FA] = useState("");
  const [verificando, setVerificando] = useState(false);

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
      navigate(respuesta.usuario.rol === "SuperAdmin" ? "/admin" : "/dashboard");
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
    } finally {
      setReenvioEnviando(false);
    }
  };

  const onVerificar2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken || !codigo2FA.trim()) return;
    setErrorGeneral("");
    setVerificando(true);
    try {
      const respuesta = await authApi.verificar2FA(challengeToken, codigo2FA.trim());
      iniciarSesion(respuesta.token, respuesta.refreshToken, respuesta.usuario);
      (document.activeElement as HTMLElement)?.blur();
      navigate(respuesta.usuario.rol === "SuperAdmin" ? "/admin" : "/dashboard");
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-3">
            <img src="/MasterLogo.png" alt="AppointVa" className="h-24 w-auto object-contain" />
          </div>
          <p className="text-gray-500 text-sm">Panel de administración</p>
        </div>

        {registroExitoso && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4 text-center">
            ¡Cuenta creada! Revisa tu correo para verificar tu cuenta antes de iniciar sesión.
          </div>
        )}

        {emailNoVerificado && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 mb-4">
            <p className="text-amber-800 text-sm font-medium mb-1">Correo no verificado</p>
            <p className="text-amber-700 text-sm mb-3">
              Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.
            </p>
            {reenvioEnviado ? (
              <p className="text-green-700 text-sm font-medium">¡Correo reenviado! Revisa tu bandeja.</p>
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {/* ── Paso 2FA ── */}
          {challengeToken ? (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-slate-700/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Verificación en dos pasos</h2>
                <p className="text-sm text-gray-500 mt-1">Ingresa el código de 6 dígitos de tu app autenticadora</p>
              </div>

              <form onSubmit={onVerificar2FA} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigo2FA}
                  onChange={(e) => setCodigo2FA(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700"
                  autoFocus
                />

                {errorGeneral && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                    {errorGeneral}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verificando || codigo2FA.length < 6}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  {verificando ? "Verificando..." : "Verificar"}
                </button>

                <button
                  type="button"
                  onClick={() => { setChallengeToken(null); setCodigo2FA(""); setErrorGeneral(""); }}
                  className="w-full text-sm text-gray-400 hover:text-gray-600 transition"
                >
                  ← Volver al inicio de sesión
                </button>
              </form>
            </>
          ) : (
            /* ── Paso login normal ── */
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Iniciar sesión</h2>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                  <input
                    type="email"
                    autoComplete="email"
                    {...register("email")}
                    className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition
                      focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                      ${errors.email ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                    placeholder="correo@ejemplo.com"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <div className="relative">
                    <input
                      type={mostrarPassword ? "text" : "password"}
                      autoComplete="current-password"
                      {...register("contrasena")}
                      className={`w-full px-4 py-2.5 pr-11 rounded-lg border text-sm outline-none transition
                        focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                        ${errors.contrasena ? "border-red-400 bg-red-50" : "border-gray-300"}`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setMostrarPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                    >
                      {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.contrasena && <p className="text-red-500 text-xs mt-1">{errors.contrasena.message}</p>}
                </div>

                {errorGeneral && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                    {errorGeneral}
                  </div>
                )}

                <div className="flex justify-end">
                  <Link to="/recuperar-contrasena" className="text-xs text-slate-700 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition text-sm"
                >
                  {isSubmitting ? "Entrando..." : "Entrar"}
                </button>
              </form>
            </>
          )}
        </div>

        {!challengeToken && (
          <p className="text-center text-sm text-gray-500 mt-4">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="text-slate-700 hover:underline font-medium">
              Registra tu negocio
            </Link>
          </p>
        )}

        <p className="text-center text-xs text-gray-400 mt-4 space-x-2">
          <span>© {new Date().getFullYear()} AppointVa</span>
          <span>·</span>
          <Link to="/privacidad" className="hover:underline hover:text-gray-600 transition">Privacidad</Link>
          <span>·</span>
          <Link to="/terminos" className="hover:underline hover:text-gray-600 transition">Términos</Link>
        </p>
      </div>
    </div>
  );
}
