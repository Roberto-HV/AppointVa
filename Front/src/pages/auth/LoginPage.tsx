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
  const locationState = location.state as { registroExitoso?: boolean; returnUrl?: string } | null;
  const registroExitoso = locationState?.registroExitoso ?? false;
  const returnUrl = locationState?.returnUrl;
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
      {/* ── Panel izquierdo — branding (solo md+) ── */}
      <div className="hidden md:flex md:w-[45%] lg:w-2/5 bg-slate-800 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
        {/* Patrón de fondo sutil */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Logo */}
        <div>
          <img src="/MasterLogo.png" alt="AppointVa" className="h-14 w-auto object-contain rounded-xl brightness-0 invert" />
        </div>

        {/* Contenido central */}
        <div className="relative">
          <h1 className="text-3xl lg:text-4xl font-bold text-white leading-snug mb-4">
            Tu agenda,<br />siempre al día.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-10">
            Gestiona citas, clientes y servicios desde un solo lugar. Sin complicaciones.
          </p>
          <ul className="space-y-4">
            {[
              "Reservas en línea 24/7",
              "Recordatorios automáticos por correo",
              "Panel de control en tiempo real",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3 text-slate-300 text-sm">
                <span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer branding */}
        <p className="relative text-slate-600 text-xs">© {new Date().getFullYear()} AppointVa</p>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6 sm:p-10 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="flex justify-center mb-8 md:hidden">
            <img src="/MasterLogo.png" alt="AppointVa" className="h-16 w-auto object-contain rounded-xl" />
          </div>

          {/* Alertas */}
          {registroExitoso && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5 text-center">
              ¡Cuenta creada! Revisa tu correo para verificar tu cuenta.
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

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-7 sm:p-8">
            {challengeToken ? (
              /* ── Paso 2FA ── */
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
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700"
                    autoFocus
                  />
                  {errorGeneral && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                      {errorGeneral}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={verificando || codigo2FA.length < 6}
                    className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition text-sm"
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
              /* ── Login normal ── */
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-1">Bienvenido de nuevo</h2>
                <p className="text-sm text-gray-400 mb-6">Ingresa a tu panel de administración</p>

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                    <input
                      type="email"
                      autoComplete="email"
                      {...register("email")}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition
                        focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                        ${errors.email ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                      placeholder="correo@ejemplo.com"
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Contraseña</label>
                      <Link to="/recuperar-contrasena" className="text-xs text-slate-600 hover:underline">
                        ¿Olvidaste tu contraseña?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        type={mostrarPassword ? "text" : "password"}
                        autoComplete="current-password"
                        {...register("contrasena")}
                        className={`w-full px-4 py-2.5 pr-11 rounded-xl border text-sm outline-none transition
                          focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700
                          ${errors.contrasena ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setMostrarPassword((v) => !v); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
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
                    {isSubmitting ? "Entrando..." : "Entrar"}
                  </button>
                </form>
              </>
            )}
          </div>

          {!challengeToken && (
            <p className="text-center text-sm text-gray-500 mt-5">
              ¿No tienes cuenta?{" "}
              <Link to="/registro" className="text-slate-700 hover:underline font-medium">
                Registra tu negocio gratis
              </Link>
            </p>
          )}

          <p className="text-center text-xs text-gray-400 mt-4 space-x-2">
            <Link to="/privacidad" className="hover:underline hover:text-gray-600 transition">Privacidad</Link>
            <span>·</span>
            <Link to="/terminos" className="hover:underline hover:text-gray-600 transition">Términos</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
