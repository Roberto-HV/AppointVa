import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../../api/auth";
import PasswordStrengthBar from "../PasswordStrengthBar";
import ReglasContrasena from "../ReglasContrasena";
import { esquemaContrasena } from "../../utils/contrasena";
import { useToastStore } from "../../store/toastStore";

// Cambio de la contraseña propia (contraseña actual + nueva). Vivía dentro de
// Mi perfil; salió a un componente para que el SuperAdmin use el mismo
// formulario en /admin/cuenta (Lote 1, G1) sin copiarlo.

const schemaPwd = z
  .object({
    passwordActual: z.string().min(1, "Requerido"),
    passwordNuevo: esquemaContrasena,
    confirmar: z.string(),
  })
  .refine((v) => v.passwordNuevo === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

type PwdForm = z.infer<typeof schemaPwd>;

interface CampoContrasenaProps {
  id: string;
  etiqueta: string;
  autoComplete: string;
  placeholder?: string;
  visible: boolean;
  onAlternar: () => void;
  error?: string;
  registro: UseFormRegisterReturn;
}

/**
 * Contraseña con etiqueta, error ligado (`aria-describedby`) y botón de
 * mostrar/ocultar alcanzable con teclado (antes `tabIndex={-1}` y sin nombre).
 */
function CampoContrasena({ id, etiqueta, autoComplete, placeholder, visible, onAlternar, error, registro }: CampoContrasenaProps) {
  const idError = `${id}-error`;
  return (
    <>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{etiqueta}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? idError : undefined}
          {...registro}
          className={`w-full min-h-[44px] lg:min-h-[36px] px-3 py-2 pr-12 rounded-lg border text-sm outline-none focus:border-accent-brand dark:bg-slate-800 dark:text-slate-100 ${error ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-slate-200 dark:border-slate-600"}`}
        />
        <button
          type="button"
          onClick={onAlternar}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? `Ocultar ${etiqueta.toLowerCase()}` : `Mostrar ${etiqueta.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
      {error && <p id={idError} className="text-red-700 dark:text-red-400 text-xs mt-1">{error}</p>}
    </>
  );
}

interface Props {
  className?: string;
}

export default function CambiarContrasena({ className = "" }: Props) {
  const { toast } = useToastStore();
  const [mostrarActual,    setMostrarActual]    = useState(false);
  const [mostrarNueva,     setMostrarNueva]     = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [mensaje,          setMensaje]          = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PwdForm>({
    resolver: zodResolver(schemaPwd),
  });
  const nuevaValor = watch("passwordNuevo", "");

  const { mutate: cambiarPassword, isPending } = useMutation({
    mutationFn: (d: PwdForm) => authApi.cambiarPassword(d.passwordActual, d.passwordNuevo),
    onSuccess: (resp) => { setMensaje({ tipo: "ok", texto: resp.mensaje }); reset(); toast("Contraseña actualizada"); },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { errores?: string[] } } })?.response?.data?.errores?.[0]
        ?? "No se pudo cambiar la contraseña.";
      setMensaje({ tipo: "error", texto: msg });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((d) => { setMensaje(null); cambiarPassword(d); })}
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 space-y-4 ${className}`}
    >
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Cambiar contraseña</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Usa una contraseña segura con mayúsculas y números</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <CampoContrasena
            id="pwd-actual"
            etiqueta="Contraseña actual"
            autoComplete="current-password"
            visible={mostrarActual}
            onAlternar={() => setMostrarActual((v) => !v)}
            error={errors.passwordActual?.message}
            registro={register("passwordActual")}
          />
        </div>

        <div>
          <CampoContrasena
            id="pwd-nueva"
            etiqueta="Nueva contraseña"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            visible={mostrarNueva}
            onAlternar={() => setMostrarNueva((v) => !v)}
            error={errors.passwordNuevo?.message}
            registro={register("passwordNuevo")}
          />
          <ReglasContrasena valor={nuevaValor ?? ""} />
          <PasswordStrengthBar password={nuevaValor} />
        </div>

        <div>
          <CampoContrasena
            id="pwd-confirmar"
            etiqueta="Confirmar contraseña"
            autoComplete="new-password"
            visible={mostrarConfirmar}
            onAlternar={() => setMostrarConfirmar((v) => !v)}
            error={errors.confirmar?.message}
            registro={register("confirmar")}
          />
        </div>
      </div>

      {mensaje && (
        <div role={mensaje.tipo === "ok" ? "status" : "alert"} className={`text-sm rounded-lg px-4 py-3 ${mensaje.tipo === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300" : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"}`}>
          {mensaje.texto}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm"
      >
        {isPending ? "Actualizando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
