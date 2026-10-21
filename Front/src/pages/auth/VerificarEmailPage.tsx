import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/axios";
import { reenviarVerificacion } from "../../api/auth";
import LogoMarca from "../../components/LogoMarca";
import { BOTON_PRIMARIO_AUTH, BOTON_SECUNDARIO_AUTH, FONDO_AUTH, TARJETA_AUTH, TITULO_AUTH, campoAuth } from "../../lib/clasesAuth";
import { esErrorTemporal, estadoHttp, mensajeError } from "../../utils/errores";
import { CORREO_SOPORTE } from "../../lib/activacion";
import { useTituloPagina } from "../../hooks/useTituloPagina";

/**
 * - `error`: el servidor rechazó el enlace (inválido o vencido).
 * - `temporal`: sin respuesta, 5xx, 408 o 429; el enlace puede ser válido (AP-03).
 */
type Estado = "cargando" | "ok" | "error" | "temporal";

const MENSAJE_INVALIDO = "El enlace de verificación es inválido o ha expirado.";

/** Segundos de espera antes de permitir otro reenvío al mismo correo. */
export const ESPERA_REENVIO_SEGUNDOS = 60;

/** La espera es por dirección: "Usar otro correo" puede enviar al momento. */
const claveCorreo = (correo: string) => correo.trim().toLowerCase();

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
  /** Segundos restantes por correo (clave normalizada). */
  const [esperas, setEsperas] = useState<Record<string, number>>({});
  const espera = esperas[claveCorreo(email)] ?? 0;
  const hayEspera = Object.values(esperas).some((s) => s > 0);

  // Cuenta atrás del reenvío: evita pedir enlaces en ráfaga al mismo correo,
  // pero no deja al usuario sin salida si el primero no llega.
  useEffect(() => {
    if (!hayEspera) return;
    const t = setTimeout(() => {
      setEsperas((prev) => {
        const sig: Record<string, number> = {};
        for (const [clave, s] of Object.entries(prev)) if (s > 1) sig[clave] = s - 1;
        return sig;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [esperas, hayEspera]);

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
      setEsperas((prev) => ({ ...prev, [claveCorreo(correo)]: ESPERA_REENVIO_SEGUNDOS }));
    } catch (err) {
      setReenvioError(mensajeError(err, "No se pudo enviar el enlace. Revisa tu conexión e intenta de nuevo."));
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className={FONDO_AUTH}>
      <div className="w-full max-w-md text-center">
        <LogoMarca prioridad className="h-20 mx-auto mb-6" />

        <div className={TARJETA_AUTH}>
          {estado === "cargando" && (
            <div role="status">
              <div className="w-12 h-12 border-4 border-slate-700 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
              <p className="text-slate-500">Verificando tu correo...</p>
            </div>
          )}

          {estado === "ok" && (
            <>
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className={TITULO_AUTH}>¡Correo verificado!</h1>
              <p className="text-slate-500 text-sm mb-6">{mensaje}</p>
              <Link
                to="/login"
                className={`inline-flex items-center justify-center ${BOTON_PRIMARIO_AUTH}`}
              >
                Iniciar sesión
              </Link>
            </>
          )}

          {estado === "temporal" && (
            <div role="alert">
              <h1 className={TITULO_AUTH}>No pudimos comprobar el enlace</h1>
              <p className="text-slate-500 text-sm mb-6">
                {sinRespuesta
                  ? "No hubo respuesta del servidor. Revisa tu conexión: tu enlace puede seguir siendo válido."
                  : "El servidor no pudo responder en este momento. Tu enlace puede seguir siendo válido; intenta de nuevo en unos minutos."}
              </p>
              <button
                type="button"
                onClick={reintentar}
                className={BOTON_PRIMARIO_AUTH}
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
              <h1 className={TITULO_AUTH}>Enlace inválido o vencido</h1>
              <p className="text-slate-500 text-sm mb-6">{mensaje} Los enlaces vencen a las 24 horas; puedes pedir uno nuevo.</p>

              {reenvioMensaje ? (
                <div className="mb-6 space-y-3">
                  <p role="status" className="text-sm text-green-700 font-medium">{reenvioMensaje}</p>
                  <p className="text-xs text-slate-500">
                    Enviado a <span className="font-medium text-slate-700 break-all">{email.trim()}</span>.
                  </p>
                  {reenvioError && <p role="alert" className="text-red-600 text-xs">{reenvioError}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => void onReenviar()}
                      disabled={reenviando || espera > 0}
                      className={`flex-1 ${BOTON_SECUNDARIO_AUTH}`}
                    >
                      {reenviando ? "Enviando..." : espera > 0 ? `Reenviar de nuevo en ${espera} s` : "Reenviar de nuevo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReenvioMensaje(""); setReenvioError(""); }}
                      className={`flex-1 ${BOTON_SECUNDARIO_AUTH}`}
                    >
                      Usar otro correo
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onReenviar} noValidate className="text-left space-y-3 mb-6">
                  <label htmlFor="email-reenvio" className="block text-sm font-medium text-slate-700">
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
                    className={campoAuth(!!reenvioError)}
                  />
                  {reenvioError && (
                    <p id="email-reenvio-error" role="alert" className="text-red-600 text-xs">{reenvioError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={reenviando || espera > 0}
                    className={BOTON_PRIMARIO_AUTH}
                  >
                    {reenviando ? "Enviando..." : espera > 0 ? `Reenviar enlace en ${espera} s` : "Reenviar enlace"}
                  </button>
                </form>
              )}

              <p className="text-xs text-slate-500 mb-4">
                ¿Te registraste con un correo equivocado? Escríbenos a{" "}
                <a href={`mailto:${CORREO_SOPORTE}`} className="underline text-slate-700">{CORREO_SOPORTE}</a>.
              </p>
              <Link to="/login" className="text-sm text-slate-700 hover:underline">
                Ir a iniciar sesión
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza tu negocio</p>
      </div>
    </div>
  );
}
