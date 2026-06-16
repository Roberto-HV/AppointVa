import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { api } from "../../api/axios";

const schema = z.object({
  nombreNegocio: z.string().min(2, "Mínimo 2 caracteres").max(150),
  slug: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  nombrePropietario: z.string().min(2, "Mínimo 2 caracteres").max(150),
  email: z.string().email("Correo inválido"),
  contrasena: z
    .string()
    .min(6, "Mínimo 6 caracteres")
    .regex(/[A-Z]/, "Debe tener al menos una mayúscula")
    .regex(/[0-9]/, "Debe tener al menos un número"),
  telefono: z.string().max(20).optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

function derivarSlug(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export default function RegistroNegocioPage() {
  const [errorGeneral, setErrorGeneral] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState(false);
  const [emailRegistrado, setEmailRegistrado] = useState("");
  const [reenvioEnviado, setReenvioEnviado] = useState(false);
  const [reenvioEnviando, setReenvioEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setValue("nombreNegocio", valor);
    if (!slugEditado) {
      setValue("slug", derivarSlug(valor), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: FormData) => {
    setErrorGeneral("");
    try {
      await api.post("/publico/registro", {
        nombreNegocio: data.nombreNegocio,
        slug: data.slug,
        nombrePropietario: data.nombrePropietario,
        email: data.email,
        contrasena: data.contrasena,
        telefono: data.telefono || undefined,
      });
      setEmailRegistrado(data.email);
      setRegistroExitoso(true);
    } catch (err: unknown) {
      const mensaje =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data
          ?.mensaje ?? "No se pudo completar el registro. Intenta de nuevo.";
      setErrorGeneral(mensaje);
    }
  };

  const reenviarVerificacion = async () => {
    if (reenvioEnviando || reenvioEnviado) return;
    setReenvioEnviando(true);
    try {
      await api.post("/publico/reenviar-verificacion", { email: emailRegistrado });
      setReenvioEnviado(true);
    } finally {
      setReenvioEnviando(false);
    }
  };

  if (registroExitoso) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <img src="/MasterLogo.png" alt="AppointVa" className="h-20 object-contain mx-auto mb-6" />
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Revisa tu correo!</h2>
            <p className="text-gray-500 text-sm mb-1">Enviamos un enlace de verificación a:</p>
            <p className="font-semibold text-gray-800 mb-5">{emailRegistrado}</p>
            <p className="text-sm text-gray-400 mb-6">
              Haz clic en el enlace del correo para activar tu cuenta. Si no lo ves, revisa la carpeta de spam.
            </p>
            {reenvioEnviado ? (
              <p className="text-sm text-green-600 font-medium mb-4">¡Correo reenviado! Revisa tu bandeja.</p>
            ) : (
              <button
                onClick={reenviarVerificacion}
                disabled={reenvioEnviando}
                className="text-sm text-primary hover:underline disabled:opacity-50 mb-4 block mx-auto"
              >
                {reenvioEnviando ? "Enviando..." : "¿No lo recibiste? Reenviar correo"}
              </button>
            )}
            <Link
              to="/login"
              className="inline-block w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition text-sm"
            >
              Ir al inicio de sesión
            </Link>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza Tu Negocio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/MasterLogo.png" alt="AppointVa" className="h-20 object-contain mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Registra tu negocio gratis</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Crear cuenta</h2>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tu negocio</p>

            {/* Nombre del negocio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio *</label>
              <input
                type="text"
                {...register("nombreNegocio")}
                onChange={onNombreChange}
                placeholder="Ej. Salón Belleza Luna"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary ${errors.nombreNegocio ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.nombreNegocio && <p className="text-red-500 text-xs mt-1">{errors.nombreNegocio.message}</p>}
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identificador (URL) *
                <span className="text-gray-400 font-normal ml-1">— tu link de reservas</span>
              </label>
              <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary border-gray-300">
                <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 whitespace-nowrap">appointva.com/b/</span>
                <input
                  type="text"
                  {...register("slug")}
                  onChange={(e) => { setSlugEditado(true); setValue("slug", e.target.value, { shouldValidate: true }); }}
                  className={`flex-1 px-3 py-2.5 text-sm outline-none bg-white ${errors.slug ? "bg-red-50" : ""}`}
                  placeholder="salon-belleza-luna"
                />
              </div>
              {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="tel"
                {...register("telefono")}
                placeholder="+52 55 1234 5678"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
            </div>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Tu cuenta</p>

            {/* Nombre del propietario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre completo *</label>
              <input
                type="text"
                {...register("nombrePropietario")}
                placeholder="Nombre y apellido"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary ${errors.nombrePropietario ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.nombrePropietario && <p className="text-red-500 text-xs mt-1">{errors.nombrePropietario.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
              <input
                type="email"
                {...register("email")}
                placeholder="correo@ejemplo.com"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary ${errors.email ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
              <input
                type="password"
                {...register("contrasena")}
                placeholder="Mínimo 6 caracteres, una mayúscula y un número"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition focus:ring-2 focus:ring-primary/40 focus:border-primary ${errors.contrasena ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {errors.contrasena && <p className="text-red-500 text-xs mt-1">{errors.contrasena.message}</p>}
            </div>

            {errorGeneral && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
                {errorGeneral}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza Tu Negocio</p>
      </div>
    </div>
  );
}
