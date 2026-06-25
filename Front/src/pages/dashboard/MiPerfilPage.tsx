import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "../../api/auth";
import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";

const schema = z
  .object({
    passwordActual: z.string().min(1, "Requerido"),
    passwordNuevo: z
      .string()
      .min(6, "Mínimo 6 caracteres")
      .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
      .regex(/[0-9]/, "Debe tener al menos un número"),
    confirmar: z.string(),
  })
  .refine((v) => v.passwordNuevo === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

type Form = z.infer<typeof schema>;

export default function MiPerfilPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const actualizarFoto = useAuthStore((s) => s.actualizarFoto);
  const { toast } = useToastStore();
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const nuevaValor = watch("passwordNuevo", "");

  const { mutate: cambiarPassword, isPending } = useMutation({
    mutationFn: (d: Form) => authApi.cambiarPassword(d.passwordActual, d.passwordNuevo),
    onSuccess: (resp) => {
      setMensaje({ tipo: "ok", texto: resp.mensaje });
      reset();
      toast("Contraseña actualizada");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { errores?: string[] } } })?.response?.data?.errores?.[0]
        ?? "No se pudo cambiar la contraseña.";
      setMensaje({ tipo: "error", texto: msg });
    },
  });

  const { mutate: subirFoto, isPending: subiendoFoto } = useMutation({
    mutationFn: (file: File) => authApi.subirFotoPerfil(file),
    onSuccess: ({ fotoUrl }) => { actualizarFoto(fotoUrl); toast("Foto actualizada"); },
    onError: () => toast("No se pudo subir la foto", "error"),
  });

  const iniciales = usuario?.nombreCompleto
    ?.split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() ?? "?";

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi perfil</h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Columna izquierda: info del usuario ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center text-center gap-3 w-full lg:w-64 shrink-0">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
              {usuario?.fotoUrl
                ? <img src={usuario.fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-slate-600">{iniciales}</span>
              }
            </div>
            {/* Badge de cámara — siempre visible */}
            <button
              type="button"
              onClick={() => fotoInputRef.current?.click()}
              disabled={subiendoFoto}
              className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center disabled:opacity-50 hover:bg-slate-700 transition"
              title="Cambiar foto"
            >
              {subiendoFoto
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <Camera size={13} className="text-white" />
              }
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(f); e.target.value = ""; }}
            />
          </div>

          {/* Nombre + email + rol */}
          <div>
            <p className="font-semibold text-gray-900 text-base">{usuario?.nombreCompleto}</p>
            <p className="text-sm text-gray-400 mt-0.5">{usuario?.email}</p>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-3 py-1 rounded-full">
            {usuario?.rol}
          </span>
          <p className="text-xs text-gray-400 mt-1">Haz clic en el ícono de cámara para cambiar tu foto</p>
        </div>

        {/* ── Columna derecha: cambiar contraseña ── */}
        <div className="flex-1 min-w-0">
          <form
            onSubmit={handleSubmit((d) => { setMensaje(null); cambiarPassword(d); })}
            className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4"
          >
            <div>
              <h2 className="text-base font-semibold text-gray-800">Cambiar contraseña</h2>
              <p className="text-sm text-gray-400 mt-0.5">Usa una contraseña segura con mayúsculas y números</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
                <div className="relative">
                  <input
                    type={mostrarActual ? "text" : "password"}
                    {...register("passwordActual")}
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700
                      ${errors.passwordActual ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarActual((v) => !v)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {mostrarActual ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.passwordActual && (
                  <p className="text-red-500 text-xs mt-1">{errors.passwordActual.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={mostrarNueva ? "text" : "password"}
                    {...register("passwordNuevo")}
                    placeholder="Mínimo 6 caracteres"
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700
                      ${errors.passwordNuevo ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarNueva((v) => !v)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.passwordNuevo && (
                  <p className="text-red-500 text-xs mt-1">{errors.passwordNuevo.message}</p>
                )}
                <PasswordStrengthBar password={nuevaValor} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={mostrarConfirmar ? "text" : "password"}
                    {...register("confirmar")}
                    className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-slate-700
                      ${errors.confirmar ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmar((v) => !v)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {mostrarConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmar && (
                  <p className="text-red-500 text-xs mt-1">{errors.confirmar.message}</p>
                )}
              </div>
            </div>

            {mensaje && (
              <div className={`text-sm rounded-lg px-4 py-3 ${
                mensaje.tipo === "ok"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-600"
              }`}>
                {mensaje.texto}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition text-sm"
            >
              {isPending ? "Actualizando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
