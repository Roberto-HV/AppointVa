import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { authApi } from "../../api/auth";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";

const schema = z
  .object({
    passwordActual: z.string().min(1, "Requerido"),
    passwordNuevo: z.string().min(6, "Mínimo 6 caracteres"),
    confirmar: z.string(),
  })
  .refine((v) => v.passwordNuevo === v.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

type Form = z.infer<typeof schema>;

export default function MiPerfilPage() {
  const usuario = useAuthStore((s) => s.usuario);
  const { toast } = useToastStore();
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

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

  const iniciales = usuario?.nombreCompleto
    ?.split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() ?? "?";

  return (
    <div className="p-4 sm:p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Mi perfil</h1>

      {/* Info del usuario */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-primary">{iniciales}</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900">{usuario?.nombreCompleto}</p>
          <p className="text-sm text-gray-400">{usuario?.email}</p>
          <span className="mt-1 inline-block text-xs bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">
            {usuario?.rol}
          </span>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <form
        onSubmit={handleSubmit((d) => { setMensaje(null); cambiarPassword(d); })}
        className="bg-white rounded-xl border border-gray-100 p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-gray-700">Cambiar contraseña</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña actual</label>
          <div className="relative">
            <input
              type={mostrarActual ? "text" : "password"}
              {...register("passwordActual")}
              className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-primary
                ${errors.passwordActual ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            <button
              type="button"
              onClick={() => setMostrarActual((v) => !v)}
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
              className={`w-full px-3 py-2 pr-10 rounded-lg border text-sm outline-none focus:border-primary
                ${errors.passwordNuevo ? "border-red-400 bg-red-50" : "border-gray-200"}`}
            />
            <button
              type="button"
              onClick={() => setMostrarNueva((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {mostrarNueva ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.passwordNuevo && (
            <p className="text-red-500 text-xs mt-1">{errors.passwordNuevo.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input
            type="password"
            {...register("confirmar")}
            className={`w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-primary
              ${errors.confirmar ? "border-red-400 bg-red-50" : "border-gray-200"}`}
          />
          {errors.confirmar && (
            <p className="text-red-500 text-xs mt-1">{errors.confirmar.message}</p>
          )}
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
  );
}
