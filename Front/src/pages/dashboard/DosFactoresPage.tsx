import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { KeyRound, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import CodigosRecuperacion from "../../components/dashboard/CodigosRecuperacion";
import { quedanPocosCodigos } from "../../utils/codigosRecuperacion";
import { useToastStore } from "../../store/toastStore";
import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import { estadoHttp, mensajeError } from "../../utils/errores";

type Paso = "idle" | "configurando" | "activado";

export default function DosFactoresPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const [paso, setPaso] = useState<Paso>("idle");
  const [uri, setUri] = useState("");
  const [llave, setLlave] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState("");
  const [errorConfig, setErrorConfig] = useState("");
  // B8: los códigos en claro solo viven en memoria mientras se muestran.
  const [codigosNuevos, setCodigosNuevos] = useState<string[] | null>(null);
  const [contrasenaCodigos, setContrasenaCodigos] = useState("");
  const [errorCodigos, setErrorCodigos] = useState("");
  const cuenta = useAuthStore((s) => s.usuario?.email);

  const { data: estado, isLoading } = useQuery({
    queryKey: ["2fa-estado"],
    queryFn: authApi.obtenerEstado2FA,
  });

  const { mutate: iniciarConfiguracion, isPending: iniciando } = useMutation({
    mutationFn: authApi.configurar2FA,
    onSuccess: (data) => {
      setUri(data.uri);
      setLlave(data.llave);
      setCodigo("");
      setErrorCodigo("");
      setErrorConfig("");
      setPaso("configurando");
    },
    // Antes un fallo dejaba el botón en "Generando..." → "Activar" sin decir nada.
    onMutate: () => setErrorConfig(""),
    onError: (err: unknown) => {
      const msg = mensajeError(err, "No se pudo iniciar la configuración de 2FA. Intenta de nuevo.");
      // 409: 2FA ya está activo (p. ej. se activó en otra pestaña). Refrescar el estado
      // muestra la vista de "activado"; cambiar de app requiere desactivar primero.
      if (estadoHttp(err) === 409) qc.invalidateQueries({ queryKey: ["2fa-estado"] });
      setErrorConfig(msg);
      toast(msg, "error");
    },
  });

  const { mutate: activar, isPending: activando } = useMutation({
    mutationFn: () => authApi.activar2FA(codigo),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["2fa-estado"] });
      setCodigosNuevos(data.codigosRecuperacion ?? []);
      setPaso("activado");
      toast("Autenticación de dos factores activada");
    },
    onError: (err: unknown) => {
      const msg = mensajeError(err, "Código incorrecto");
      if (estadoHttp(err) === 409) {
        // Ya estaba activo: volver a la vista normal con el estado real.
        qc.invalidateQueries({ queryKey: ["2fa-estado"] });
        setPaso("idle");
        setCodigo("");
        toast(msg, "error");
        return;
      }
      setErrorCodigo(msg);
    },
  });

  const { mutate: regenerarCodigos, isPending: regenerando } = useMutation({
    mutationFn: () => authApi.regenerarCodigosRecuperacion({ contrasena: contrasenaCodigos }),
    onMutate: () => setErrorCodigos(""),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["2fa-estado"] });
      setContrasenaCodigos("");
      setCodigosNuevos(data.codigosRecuperacion);
      toast("Códigos nuevos generados. Los anteriores ya no sirven.");
    },
    onError: (err: unknown) => {
      setErrorCodigos(mensajeError(err, "No se pudieron generar los códigos. Intenta de nuevo."));
    },
  });

  const { mutate: desactivar, isPending: desactivando } = useMutation({
    mutationFn: () => authApi.desactivar2FA(codigo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["2fa-estado"] });
      setPaso("idle");
      setCodigo("");
      setUri("");
      setLlave("");
      toast("Autenticación de dos factores desactivada");
    },
    onError: (err: unknown) => {
      setErrorCodigo(mensajeError(err, "Código incorrecto"));
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
      </div>
    );
  }

  const inputCodigo = (
    <div>
      <label htmlFor="codigo-2fa" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código de verificación</label>
      <input
        id="codigo-2fa"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-invalid={!!errorCodigo}
        aria-describedby={errorCodigo ? "codigo-2fa-error" : undefined}
        maxLength={6}
        value={codigo}
        onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, "")); setErrorCodigo(""); }}
        placeholder="000000"
        className="w-full px-4 py-2.5 text-center text-xl font-mono tracking-[0.5em] rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-accent-brand"
      />
      {errorCodigo && <p id="codigo-2fa-error" role="alert" className="text-red-700 dark:text-red-400 text-xs mt-1 text-center">{errorCodigo}</p>}
    </div>
  );

  return (
    <div className="p-6 w-full flex flex-col items-center">
    <div className="w-full max-w-lg space-y-6">
      <EncabezadoPagina titulo="Seguridad" subtitulo="Autenticación de dos factores (2FA)" />

      {/* Estado actual */}
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${
        estado?.habilitado
          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
          : "bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-700"
      }`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          estado?.habilitado
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300"
        }`}>
          {estado?.habilitado ? <ShieldCheck size={20} /> : <Shield size={20} />}
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {estado?.habilitado ? "2FA activado" : "2FA desactivado"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {estado?.habilitado
              ? "Tu cuenta está protegida con autenticación de dos factores."
              : "Activa 2FA para mayor seguridad en tu cuenta."}
          </p>
        </div>
      </div>

      {/* ── Si 2FA está desactivado ── */}
      {!estado?.habilitado && paso === "idle" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 space-y-4">
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">¿Cómo funciona?</h2>
          <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal list-inside">
            <li>Descarga una app autenticadora (Google Authenticator, Authy, etc.)</li>
            <li>Escanea el código QR que te mostraremos</li>
            <li>Ingresa el código de 6 dígitos para confirmar</li>
            <li>Desde ese momento, necesitarás el código al iniciar sesión</li>
          </ol>
          <button
            onClick={() => iniciarConfiguracion()}
            disabled={iniciando}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition"
          >
            {iniciando ? "Generando..." : "Activar autenticación en dos pasos"}
          </button>
          {errorConfig && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {errorConfig}
            </p>
          )}
        </div>
      )}

      {/* ── Paso: escanear QR ── */}
      {!estado?.habilitado && paso === "configurando" && (
        // Formulario: Enter con el código escrito confirma la activación.
        <form
          onSubmit={(e) => { e.preventDefault(); if (!activando && codigo.length === 6) activar(); }}
          className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 space-y-5"
        >
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Escanea el código QR</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Abre tu app autenticadora y escanea este código.</p>
          </div>

          <div className="flex justify-center">
            <div className="p-3 bg-white border-2 border-slate-100 rounded-xl inline-block">
              <QRCodeSVG value={uri} size={180} />
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 text-center">O ingresa la clave manualmente:</p>
            <p className="text-center font-mono text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-2 tracking-widest select-all">
              {llave}
            </p>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Al confirmar te daremos 10 códigos de recuperación para entrar si pierdes el teléfono.
            </p>
          </div>

          {inputCodigo}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setPaso("idle"); setCodigo(""); setErrorCodigo(""); }}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={activando || codigo.length < 6}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition"
            >
              {activando ? "Verificando..." : "Confirmar activación"}
            </button>
          </div>
        </form>
      )}

      {/* ── 2FA ya estaba activado, mostrar éxito ── */}
      {paso === "activado" && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 rounded-xl p-5 text-center">
          <ShieldCheck size={32} className="text-emerald-600 dark:text-emerald-400 mx-auto mb-2" aria-hidden="true" />
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">¡2FA activado correctamente!</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">Desde ahora necesitarás el código al iniciar sesión.</p>
        </div>
      )}
      {paso === "activado" && codigosNuevos && codigosNuevos.length > 0 && (
        <CodigosRecuperacion
          codigos={codigosNuevos}
          cuenta={cuenta}
          onListo={() => { setCodigosNuevos(null); setPaso("idle"); }}
        />
      )}

      {/* ── Códigos de recuperación (B8) ── */}
      {estado?.habilitado && paso !== "activado" && (
        codigosNuevos ? (
          <CodigosRecuperacion codigos={codigosNuevos} cuenta={cuenta} onListo={() => setCodigosNuevos(null)} />
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (!regenerando && contrasenaCodigos) regenerarCodigos(); }}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 space-y-4"
            aria-labelledby="codigos-titulo"
          >
            <div className="flex items-center gap-2">
              <KeyRound size={18} className="text-slate-600 dark:text-slate-300" aria-hidden="true" />
              <h2 id="codigos-titulo" className="font-semibold text-slate-800 dark:text-slate-200">Códigos de recuperación</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Te quedan <span className="font-semibold tabular-nums text-foreground">{estado.codigosRecuperacionRestantes ?? 0}</span> códigos sin usar. Cada uno sirve una vez para entrar sin tu app autenticadora.
            </p>
            {quedanPocosCodigos(estado.codigosRecuperacionRestantes ?? 0) && (
              <p role="alert" className="text-sm font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                {(estado.codigosRecuperacionRestantes ?? 0) === 0
                  ? "Ya no te quedan códigos. Genera nuevos para no quedarte fuera si pierdes el teléfono."
                  : "Te quedan pocos códigos. Genera nuevos para no quedarte fuera si pierdes el teléfono."}
              </p>
            )}
            <div>
              <label htmlFor="contrasena-codigos" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tu contraseña</label>
              <input
                id="contrasena-codigos"
                type="password"
                autoComplete="current-password"
                value={contrasenaCodigos}
                aria-invalid={!!errorCodigos}
                aria-describedby={errorCodigos ? "contrasena-codigos-error" : undefined}
                onChange={(e) => { setContrasenaCodigos(e.target.value); setErrorCodigos(""); }}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 outline-none focus:border-accent-brand"
              />
              {errorCodigos && <p id="contrasena-codigos-error" role="alert" className="text-red-700 dark:text-red-400 text-xs mt-1">{errorCodigos}</p>}
            </div>
            <button
              type="submit"
              disabled={regenerando || !contrasenaCodigos}
              className="w-full py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-300 disabled:opacity-40 transition"
            >
              {regenerando ? "Generando..." : "Generar códigos nuevos"}
            </button>
            <p className="text-xs text-muted-foreground">Los códigos anteriores dejarán de servir.</p>
          </form>
        )
      )}

      {/* ── Si 2FA está activado, opción de desactivar ── */}
      {estado?.habilitado && paso !== 'activado' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldOff size={18} />
            <h2 className="font-semibold">Desactivar autenticación en dos pasos</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Para desactivar 2FA, ingresa un código válido de tu app autenticadora.
          </p>

          {inputCodigo}

          <button
            onClick={() => desactivar()}
            disabled={desactivando || codigo.length < 6}
            className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition"
          >
            {desactivando ? "Desactivando..." : "Desactivar 2FA"}
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
