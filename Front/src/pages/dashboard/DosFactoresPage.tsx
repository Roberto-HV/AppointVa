import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { authApi } from "../../api/auth";
import { useToastStore } from "../../store/toastStore";

type Paso = "idle" | "configurando" | "activado";

export default function DosFactoresPage() {
  const qc = useQueryClient();
  const { toast } = useToastStore();

  const [paso, setPaso] = useState<Paso>("idle");
  const [uri, setUri] = useState("");
  const [llave, setLlave] = useState("");
  const [codigo, setCodigo] = useState("");
  const [errorCodigo, setErrorCodigo] = useState("");

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
      setPaso("configurando");
    },
  });

  const { mutate: activar, isPending: activando } = useMutation({
    mutationFn: () => authApi.activar2FA(codigo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["2fa-estado"] });
      setPaso("activado");
      toast("Autenticación de dos factores activada");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "Código incorrecto";
      setErrorCodigo(msg);
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
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? "Código incorrecto";
      setErrorCodigo(msg);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const inputCodigo = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Código de verificación</label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={codigo}
        onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, "")); setErrorCodigo(""); }}
        placeholder="000000"
        className="w-full px-4 py-2.5 text-center text-xl font-mono tracking-[0.5em] rounded-lg border border-gray-200 outline-none focus:border-slate-700"
        autoFocus
      />
      {errorCodigo && <p className="text-red-500 text-xs mt-1 text-center">{errorCodigo}</p>}
    </div>
  );

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Seguridad</h1>
        <p className="text-sm text-gray-500 mt-0.5">Autenticación de dos factores (2FA)</p>
      </div>

      {/* Estado actual */}
      <div className={`rounded-xl border p-5 flex items-center gap-4 ${
        estado?.habilitado ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-100"
      }`}>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          estado?.habilitado ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-400"
        }`}>
          {estado?.habilitado ? <ShieldCheck size={20} /> : <Shield size={20} />}
        </div>
        <div>
          <p className="font-semibold text-gray-900">
            {estado?.habilitado ? "2FA activado" : "2FA desactivado"}
          </p>
          <p className="text-sm text-gray-500">
            {estado?.habilitado
              ? "Tu cuenta está protegida con autenticación de dos factores."
              : "Activa 2FA para mayor seguridad en tu cuenta."}
          </p>
        </div>
      </div>

      {/* ── Si 2FA está desactivado ── */}
      {!estado?.habilitado && paso === "idle" && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">¿Cómo funciona?</h2>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
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
        </div>
      )}

      {/* ── Paso: escanear QR ── */}
      {!estado?.habilitado && paso === "configurando" && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">Escanea el código QR</h2>
            <p className="text-sm text-gray-500">Abre tu app autenticadora y escanea este código.</p>
          </div>

          <div className="flex justify-center">
            <div className="p-3 bg-white border-2 border-gray-100 rounded-xl inline-block">
              <QRCodeSVG value={uri} size={180} />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1 text-center">O ingresa la clave manualmente:</p>
            <p className="text-center font-mono text-sm font-semibold text-gray-700 bg-gray-50 rounded-lg px-4 py-2 tracking-widest select-all">
              {llave}
            </p>
          </div>

          {inputCodigo}

          <div className="flex gap-3">
            <button
              onClick={() => { setPaso("idle"); setCodigo(""); setErrorCodigo(""); }}
              className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 transition"
            >
              Cancelar
            </button>
            <button
              onClick={() => activar()}
              disabled={activando || codigo.length < 6}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition"
            >
              {activando ? "Verificando..." : "Confirmar activación"}
            </button>
          </div>
        </div>
      )}

      {/* ── 2FA ya estaba activado, mostrar éxito ── */}
      {paso === "activado" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <ShieldCheck size={32} className="text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-800">¡2FA activado correctamente!</p>
          <p className="text-sm text-green-600 mt-1">Desde ahora necesitarás el código al iniciar sesión.</p>
        </div>
      )}

      {/* ── Si 2FA está activado, opción de desactivar ── */}
      {estado?.habilitado && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <ShieldOff size={18} />
            <h2 className="font-semibold">Desactivar autenticación en dos pasos</h2>
          </div>
          <p className="text-sm text-gray-500">
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
  );
}
