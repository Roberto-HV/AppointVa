import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/axios";
import { reenviarVerificacion } from "../../api/auth";
import LogoMarca from "../../components/LogoMarca";
import { esErrorTemporal, estadoHttp, mensajeError } from "../../utils/errores";
import { CORREO_SOPORTE } from "../../lib/activacion";
import { useTituloPagina } from "../../hooks/useTituloPagina";

/**
 * - `error`: el servidor rechazó el enlace (inválido o vencido).
 * - `temporal`: sin respuesta, 5xx, 408 o 429; el enlace puede ser válido (AP-03).
 */
type Estado = "cargando" | "ok" | "error" | "temporal";

const MENSAJE_INVALIDO = "El enlace de verificación es inválido o ha expirado.";

/** Segundos de espera antes de permitir otro reenvío desde esta pantalla. */
export const ESPERA_REENVIO_SEGUNDOS = 60;

export default function VerificarEmailPage() {
  useTituloPagina("Verificar correo");
  const [searchParams] = useSearchParams();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState("");
  const [sinRespuesta, setSinRespuesta] = useState(false);
  const [intento, setIntento] = useState(0);

  const [email, setEmail] = useState("");
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMensaje, setReenvioMensaje] = useState("");
  const [reenvioError, setReenvioError] = useState("");
  const [espera, setEspera] = useState(0);

  // Cuenta atrás del reenvío: evita pedir enlaces en ráfaga, pero no deja al
  // usuario sin salida si el primero no llega.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  useEffect(() => {
    const userId = searchParams.get("userId");
    const token = searchParams.get("token");

    if (!userId || !token) {
      setMensaje("El enlace de verificación es inválido o está incompleto.");
      setEstado("error");
      return;
    }

    setEstado("cargando");
    api
      .get("/publico/verificar-email", { params: { userId, token } })
      .then((res) => {
        setMensaje(res.data?.mensaje ?? "¡Correo verificado!");
        setEstado("ok");
      })
      .catch((err) => {
        if (esErrorTemporal(err)) {
          setSinRespuesta(estadoHttp(err) === undefined);
          setEstado("temporal");
          return;
        }
        setMensaje(mensajeError(err, MENSAJE_INVALIDO));
        setEstado("error");
      });
  }, [searchParams, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  const onReenviar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (reenviando || espera > 0) return;
    const correo = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(correo)) {
      setReenvioError("Escribe un correo válido.");
      return;
    }
    setReenvioError("");
    setReenviando(true);
    try {
      const { mensaje: respuesta } = await reenviarVerificacion(correo);
      setReenvioMensaje(
        respuesta || "Si el correo está registrado y pendiente de verificación, recibirás un email."
      );
      setEspera(ESPERA_REENVIO_SEGUNDOS);
    } catch (err) {
      setReenvioError(mensajeError(err, "No se pudo enviar el enlace. Revisa tu conexión e intenta de nuevo."));
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <LogoMarca prioridad className="h-20 mx-auto mb-6" />

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {estado === "cargando" && (
            <div role="status">
              <div className="w-12 h-12 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
              <p className="text-gray-500">Verificando tu correo...</p>
            </div>
          )}

          {estado === "ok" && (
            <>
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-800 mb-2">¡Correo verificado!</h1>
              <p className="text-gray-500 text-sm mb-6">{mensaje}</p>
              <Link
                to="/login"
                className="inline-block w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition text-sm"
              >
                Iniciar sesión
              </Link>
            </>
          )}

          {estado === "temporal" && (
            <div role="alert">
              <h1 className="text-xl font-semibold text-gray-800 mb-2">No pudimos comprobar el enlace</h1>
              <p className="text-gray-500 text-sm mb-6">
                {sinRespuesta
                  ? "No hubo respuesta del servidor. Revisa tu conexión: tu enlace puede seguir siendo válido."
                  : "El servidor no pudo responder en este momento. Tu enlace puede seguir siendo válido; intenta de nuevo en unos minutos."}
              </p>
              <button
                type="button"
                onClick={reintentar}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg transition text-sm"
              >
                Reintentar
              </button>
            </div>
          )}

          {estado === "error" && (
            <>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-800 mb-2">Enlace inválido o vencido</h1>
              <p className="text-gray-500 text-sm mb-6">{mensaje} Los enlaces vencen a las 24 horas; puedes pedir uno nuevo.</p>

              {reenvioMensaje ? (
                <div className="mb-6 space-y-3">
                  <p role="status" className="text-sm text-green-700 font-medium">{reenvioMensaje}</p>
                  <p className="text-xs text-gray-500">
                    Enviado a <span className="font-medium text-gray-700 break-all">{email.trim()}</span>.
                  </p>
                  {reenvioError && <p role="alert" className="text-red-600 text-xs">{reenvioError}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => void onReenviar()}
                      disabled={reenviando || espera > 0}
                      className="flex-1 min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
                    >
                      {reenviando ? "Enviando..." : espera > 0 ? `Reenviar de nuevo en ${espera} s` : "Reenviar de nuevo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReenvioMensaje(""); setReenvioError(""); }}
                      className="flex-1 min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                      Usar otro correo
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onReenviar} noValidate className="text-left space-y-3 mb-6">
                  <label htmlFor="email-reenvio" className="block text-sm font-medium text-gray-700">
                    Correo con el que te registraste
                  </label>
                  <input
                    id="email-reenvio"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={reenvioError ? true : undefined}
                    aria-describedby={reenvioError ? "email-reenvio-error" : undefined}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none transition focus:ring-2 focus:ring-slate-700/40 focus:border-slate-700"
                  />
                  {reenvioError && (
                    <p id="email-reenvio-error" role="alert" className="text-red-600 text-xs">{reenvioError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={reenviando || espera > 0}
                    className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition text-sm"
                  >
                    {reenviando ? "Enviando..." : espera > 0 ? `Reenviar enlace en ${espera} s` : "Reenviar enlace"}
                  </button>
                </form>
              )}

              <p className="text-xs text-gray-500 mb-4">
                ¿Te registraste con un correo equivocado? Escríbenos a{" "}
                <a href={`mailto:${CORREO_SOPORTE}`} className="underline text-slate-700">{CORREO_SOPORTE}</a>.
              </p>
              <Link to="/login" className="text-sm text-slate-700 hover:underline">
                Ir a iniciar sesión
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza tu negocio</p>
      </div>
    </div>
  );
}
