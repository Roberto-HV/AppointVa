import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { authApi } from "../../../api/auth";
import ModalAcciones from "../../../components/ui/ModalAcciones";
import { esDosFactoresRequerido, guardarPrueba } from "../../../lib/pruebaReautenticacion";
import { RUTA_SEGURIDAD_ADMIN } from "../../../layouts/rutasAdmin";
import { mensajeError } from "../../../utils/errores";
import { BOTON_PIE_PRIMARIO, BOTON_PIE_SECUNDARIO, CAMPO_ERROR, CAMPO_MODAL, CAMPO_OK } from "./estilos";

/**
 * "Confirma que eres tú" (lote 5, G1): contraseña y código de la app antes de una
 * acción sensible. Se pinta dentro del modal de la acción, en lugar de su
 * contenido, para no abrir un diálogo encima de otro. Al confirmar, la prueba
 * queda en memoria 5 minutos y `onConfirmado` sigue con la acción.
 */
export default function FormReautenticacion({
  accion,
  onConfirmado,
  onCancelar,
}: {
  /** Qué se va a hacer, en minúsculas: "eliminar Barbería Luis". */
  accion: string;
  onConfirmado: (prueba: string) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [falta2FA, setFalta2FA] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const contrasenaRef = useRef<HTMLInputElement>(null);

  const { data: estado2FA } = useQuery({
    queryKey: ["2fa-estado"],
    queryFn: authApi.obtenerEstado2FA,
    staleTime: 1000 * 60,
  });
  const sin2FA = falta2FA || estado2FA?.habilitado === false;

  useEffect(() => { contrasenaRef.current?.focus(); }, []);

  const confirmar = async (e: FormEvent) => {
    e.preventDefault();
    if (!contrasena || !codigo.trim()) return;
    setError("");
    setEnviando(true);
    try {
      const { token, expiracion } = await authApi.reautenticar(contrasena, codigo.trim());
      guardarPrueba(token, expiracion);
      onConfirmado(token);
    } catch (err) {
      if (esDosFactoresRequerido(err)) setFalta2FA(true);
      setError(mensajeError(err, "No pudimos confirmar tu identidad. Intenta de nuevo."));
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  };

  if (sin2FA) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Para {accion} necesitas la verificación en dos pasos. Es obligatoria en la cuenta de administración.
        </p>
        <ModalAcciones>
          <button type="button" onClick={onCancelar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
          <Link to={RUTA_SEGURIDAD_ADMIN} className={`${BOTON_PIE_PRIMARIO} inline-flex items-center justify-center`}>
            Activar verificación en dos pasos
          </Link>
        </ModalAcciones>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="space-y-4" aria-labelledby={`${id}-titulo`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-9 h-9 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <ShieldCheck size={18} className="text-slate-700 dark:text-slate-200" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id={`${id}-titulo`} className="text-sm font-semibold text-slate-800 dark:text-slate-100">Confirma que eres tú</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Vas a {accion}. Escribe tu contraseña y el código de tu app autenticadora.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-contrasena`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Tu contraseña
        </label>
        <input
          ref={contrasenaRef}
          id={`${id}-contrasena`}
          type="password"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          className={`${CAMPO_MODAL} ${error ? CAMPO_ERROR : CAMPO_OK}`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-codigo`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Código de verificación
        </label>
        <input
          id={`${id}-codigo`}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          aria-describedby={`${id}-ayuda`}
          className={`${CAMPO_MODAL} tabular-nums tracking-widest ${error ? CAMPO_ERROR : CAMPO_OK}`}
        />
        <p id={`${id}-ayuda`} className="text-xs text-muted-foreground mt-1">
          El de 6 dígitos de tu app. Si no tienes el teléfono, usa un código de recuperación.
        </p>
      </div>

      {error && (
        <p role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <ModalAcciones>
        <button type="button" onClick={onCancelar} className={BOTON_PIE_SECUNDARIO}>Cancelar</button>
        <button type="submit" disabled={enviando || !contrasena || !codigo.trim()} className={BOTON_PIE_PRIMARIO}>
          {enviando ? "Confirmando…" : "Confirmar y continuar"}
        </button>
      </ModalAcciones>
    </form>
  );
}
