import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Scissors, HeartPulse, CheckCircle, XCircle } from "lucide-react";
import { api } from "../../api/axios";
import { reenviarVerificacion } from "../../api/auth";
import { useDisponibilidadSlug } from "../../hooks/useDisponibilidadSlug";
import PasswordStrengthBar from "../../components/PasswordStrengthBar";
import ReglasContrasena from "../../components/ReglasContrasena";
import LogoMarca from "../../components/LogoMarca";
import { FONDO_AUTH, TITULO_AUTH } from "../../lib/clasesAuth";
import { esquemaContrasena, traducirErroresIdentity } from "../../utils/contrasena";
import { mensajeError } from "../../utils/errores";
import { ACTIVACION_PASOS, CORREO_SOPORTE } from "../../lib/activacion";
import { useTituloPagina } from "../../hooks/useTituloPagina";

type Sector = "belleza" | "salud";

const SECTORES: { value: Sector; Icon: typeof Scissors; label: string }[] = [
  { value: "belleza", Icon: Scissors, label: "Belleza y estética" },
  { value: "salud", Icon: HeartPulse, label: "Salud" },
];

const schema = z
  .object({
    nombreNegocio: z.string().min(2, "Mínimo 2 caracteres").max(150),
    slug: z
      .string()
      .min(2, "Mínimo 2 caracteres")
      .max(80)
      .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
    nombrePropietario: z.string().min(2, "Mínimo 2 caracteres").max(150),
    email: z.string().email("Correo inválido"),
    contrasena: esquemaContrasena,
    confirmarContrasena: z.string().min(1, "Confirma tu contraseña"),
    telefono: z.string().max(20).optional().or(z.literal("")),
  })
  .refine((v) => v.contrasena === v.confirmarContrasena, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarContrasena"],
  });

type FormData = z.infer<typeof schema>;

// Prefijo del enlace público tal como lo verá el cliente. Se toma del origen
// actual en vez de escribir "appointva.com" (AP-13).
const PREFIJO_ENLACE = `${typeof window !== "undefined" ? window.location.host : "appointva.com"}/b/`;

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
  useTituloPagina("Registra tu negocio");
  const [errorGeneral, setErrorGeneral] = useState("");
  const [erroresServidor, setErroresServidor] = useState<string[]>([]);
  const [reenvioError, setReenvioError] = useState("");
  const [slugRegistrado, setSlugRegistrado] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState(false);
  const [emailRegistrado, setEmailRegistrado] = useState("");
  const [reenvioEnviado, setReenvioEnviado] = useState(false);
  const [reenvioEnviando, setReenvioEnviando] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const [searchParams] = useSearchParams();
  // `?sector=salud` (landing /salud) solo preselecciona: el giro siempre se
  // puede cambiar aquí, porque después solo lo cambia el SuperAdmin (AP-01).
  const sectorParam = searchParams.get("sector");
  const [sector, setSector] = useState<Sector>(sectorParam === "salud" ? "salud" : "belleza");

  const onSectorKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const siguiente: Sector = sector === "belleza" ? "salud" : "belleza";
    setSector(siguiente);
    const grupo = e.currentTarget.parentElement;
    grupo?.querySelector<HTMLButtonElement>(`[data-sector="${siguiente}"]`)?.focus();
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const contrasenaValor = watch("contrasena", "");
  const slugValue = watch("slug");

  const slugEstado = useDisponibilidadSlug(slugValue);

  // Se encadena el `onChange` de react-hook-form en vez de reemplazarlo, para
  // que el error "Mínimo 2 caracteres" desaparezca al corregir (AP-13).
  const nombreRegistro = register("nombreNegocio");
  const slugRegistro = register("slug");

  const onNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void nombreRegistro.onChange(e);
    if (!slugEditado) {
      setValue("slug", derivarSlug(e.target.value), { shouldValidate: isSubmitted });
    }
  };

  const onSubmit = async (data: FormData) => {
    setErrorGeneral("");
    setErroresServidor([]);
    try {
      await api.post("/publico/registro", {
        nombreNegocio: data.nombreNegocio,
        slug: data.slug,
        nombrePropietario: data.nombrePropietario,
        email: data.email,
        contrasena: data.contrasena,
        telefono: data.telefono || undefined,
        sector,
      });
      setEmailRegistrado(data.email);
      setSlugRegistrado(data.slug);
      setRegistroExitoso(true);
    } catch (err: unknown) {
      setErrorGeneral(mensajeError(err, "No se pudo completar el registro. Intenta de nuevo."));
      // Identity explica el motivo en `errores` (en inglés); se traducen los conocidos.
      setErroresServidor(
        traducirErroresIdentity((err as { response?: { data?: { errores?: unknown } } })?.response?.data?.errores)
      );
    }
  };

  const onReenviar = async () => {
    if (reenvioEnviando || reenvioEnviado) return;
    setReenvioEnviando(true);
    setReenvioError("");
    try {
      await reenviarVerificacion(emailRegistrado);
      setReenvioEnviado(true);
    } catch {
      setReenvioError("No se pudo reenviar el correo. Intenta de nuevo.");
    } finally {
      setReenvioEnviando(false);
    }
  };

  if (registroExitoso) {
    return (
      <div className={FONDO_AUTH}>
        <div className="w-full max-w-md text-center">
          <LogoMarca prioridad className="h-20 mx-auto mb-6" />
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="w-14 h-14 bg-slate-700/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <h1 className={TITULO_AUTH}>¡Revisa tu correo!</h1>
            <p className="text-slate-500 text-sm mb-1">Enviamos un enlace de verificación a:</p>
            <p className="font-semibold text-slate-800 mb-4 break-all">{emailRegistrado}</p>
            <p className="text-sm text-slate-500 mb-5">Si no lo ves, revisa la carpeta de spam.</p>

            <div className="text-left bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Qué sigue</h2>
              <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-600">
                {ACTIVACION_PASOS.map((paso) => <li key={paso}>{paso}</li>)}
              </ol>
            </div>

            {reenvioEnviado ? (
              <p role="status" className="text-sm text-green-700 font-medium mb-4">¡Correo reenviado! Revisa tu bandeja.</p>
            ) : (
              <button
                type="button"
                onClick={onReenviar}
                disabled={reenvioEnviando}
                className="text-sm text-slate-700 hover:underline disabled:opacity-50 mb-4 block mx-auto min-h-[44px]"
              >
                {reenvioEnviando ? "Enviando..." : "¿No lo recibiste? Reenviar correo"}
              </button>
            )}
            {reenvioError && <p role="alert" className="text-sm text-red-600 mb-4">{reenvioError}</p>}

            <p className="text-xs text-slate-500 mb-5">
              ¿Escribiste mal tu correo? No se puede cambiar desde aquí. Escríbenos a{" "}
              <a href={`mailto:${CORREO_SOPORTE}`} className="underline text-slate-700">{CORREO_SOPORTE}</a>{" "}
              indicando el identificador <span className="font-medium text-slate-700">{slugRegistrado}</span> y el correo correcto.
            </p>
            <Link
              to="/login"
              className="inline-block w-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition text-sm"
            >
              Ir al inicio de sesión
            </Link>
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza tu negocio</p>
        </div>
      </div>
    );
  }

  return (
    <div className={FONDO_AUTH}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <LogoMarca prioridad className="h-20 mx-auto mb-2 rounded-xl" />
          <p className="text-slate-500 text-sm">Registra tu negocio</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Crear cuenta</h1>
          <p className="text-sm text-slate-500 mb-6">Completa los datos para registrar tu negocio</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <p className="text-xs text-slate-500">Todos los campos son obligatorios salvo los marcados como opcionales.</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tu negocio</p>

            {/* Nombre del negocio */}
            <div>
              <label htmlFor="registro-nombre-negocio" className="block text-sm font-medium text-slate-700 mb-1">Nombre del negocio</label>
              <input
                id="registro-nombre-negocio"
                type="text"
                autoComplete="organization"
                {...nombreRegistro}
                onChange={onNombreChange}
                placeholder="Ej. Salón Belleza Luna"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700 ${errors.nombreNegocio ? "border-red-400 bg-red-50" : "border-slate-200"}`}
              />
              {errors.nombreNegocio && <p className="text-red-500 text-xs mt-1">{errors.nombreNegocio.message}</p>}
            </div>

            {/* Slug */}
            <div>
              <label htmlFor="registro-slug" className="block text-sm font-medium text-slate-700 mb-1">
                Identificador (URL)
                <span className="text-slate-500 font-normal ml-1">— tu link de reservas</span>
              </label>
              <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-700/30 focus-within:border-slate-700 border-slate-200">
                <span className="px-3 py-2.5 bg-slate-50 text-slate-400 text-sm border-r border-slate-200 whitespace-nowrap">{PREFIJO_ENLACE}</span>
                <input
                  id="registro-slug"
                  type="text"
                  autoComplete="off"
                  {...slugRegistro}
                  onChange={(e) => { setSlugEditado(true); void slugRegistro.onChange(e); }}
                  className={`flex-1 px-3 py-2.5 text-sm outline-none bg-white ${errors.slug ? "bg-red-50" : ""}`}
                  placeholder="salon-belleza-luna"
                />
              </div>
              {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
              {slugEstado === 'checking' && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Verificando…
                </p>
              )}
              {slugEstado === 'available' && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle size={12} />
                  Disponible
                </p>
              )}
              {slugEstado === 'taken' && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <XCircle size={12} />
                  Ya está en uso — elige otro
                </p>
              )}
            </div>

            {/* Giro del negocio */}
            <div>
              <p id="etiqueta-sector" className="block text-sm font-medium text-slate-700 mb-2">
                Giro del negocio
              </p>
              <div role="radiogroup" aria-labelledby="etiqueta-sector" aria-describedby="ayuda-sector" className="grid grid-cols-2 gap-3">
                {SECTORES.map(({ value, Icon, label }) => {
                  const elegido = sector === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={elegido}
                      tabIndex={elegido ? 0 : -1}
                      data-sector={value}
                      onClick={() => setSector(value)}
                      onKeyDown={onSectorKeyDown}
                      className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700/40 ${
                        elegido
                          ? "border-slate-700 bg-slate-50 text-slate-700"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <Icon size={22} aria-hidden="true" />
                      <span className="text-xs">{label}</span>
                    </button>
                  );
                })}
              </div>
              <p id="ayuda-sector" className="text-xs text-slate-500 mt-1.5">
                Define el vocabulario y los módulos de tu panel. Clínicas y consultorios: elige Salud.
              </p>
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="registro-telefono" className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono <span className="text-slate-500 font-normal">(opcional)</span>
              </label>
              <input
                id="registro-telefono"
                type="tel"
                autoComplete="tel"
                {...register("telefono")}
                placeholder="+52 55 1234 5678"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700"
              />
            </div>

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">Tu cuenta</p>

            {/* Nombre del propietario */}
            <div>
              <label htmlFor="registro-propietario" className="block text-sm font-medium text-slate-700 mb-1">Tu nombre completo</label>
              <input
                id="registro-propietario"
                type="text"
                autoComplete="name"
                {...register("nombrePropietario")}
                placeholder="Nombre y apellido"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700 ${errors.nombrePropietario ? "border-red-400 bg-red-50" : "border-slate-200"}`}
              />
              {errors.nombrePropietario && <p className="text-red-500 text-xs mt-1">{errors.nombrePropietario.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="registro-email" className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
              <input
                id="registro-email"
                type="email"
                autoComplete="email"
                {...register("email")}
                placeholder="correo@ejemplo.com"
                className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700 ${errors.email ? "border-red-400 bg-red-50" : "border-slate-200"}`}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="registro-contrasena" className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
              <div className="relative">
                <input
                  id="registro-contrasena"
                  type={mostrarContrasena ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("contrasena")}
                  aria-describedby="reglas-contrasena"
                  className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700 ${errors.contrasena ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setMostrarContrasena((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {mostrarContrasena ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.contrasena && <p className="text-red-500 text-xs mt-1">{errors.contrasena.message}</p>}
              <ReglasContrasena id="reglas-contrasena" valor={contrasenaValor ?? ""} />
              <PasswordStrengthBar password={contrasenaValor} />
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label htmlFor="registro-confirmar" className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
              <div className="relative">
                <input
                  id="registro-confirmar"
                  type={mostrarConfirmar ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("confirmarContrasena")}
                  placeholder="Repite tu contraseña"
                  className={`w-full px-4 py-3 pr-11 rounded-xl border text-sm outline-none transition focus:ring-2 focus:ring-slate-700/30 focus:border-slate-700 ${errors.confirmarContrasena ? "border-red-400 bg-red-50" : "border-slate-200"}`}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setMostrarConfirmar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {mostrarConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmarContrasena && <p className="text-red-500 text-xs mt-1">{errors.confirmarContrasena.message}</p>}
            </div>

            {errorGeneral && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {errorGeneral}
                {erroresServidor.length > 0 && (
                  <ul className="list-disc pl-5 mt-1">
                    {erroresServidor.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || slugEstado === 'taken' || slugEstado === 'checking'}
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition text-sm"
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Al crear tu cuenta, aceptas nuestros{" "}
              <Link to="/terminos" target="_blank" className="underline hover:text-slate-600 transition">
                Términos de uso
              </Link>{" "}
              y nuestra{" "}
              <Link to="/privacidad" target="_blank" className="underline hover:text-slate-600 transition">
                Política de privacidad
              </Link>.
            </p>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-slate-700 hover:underline font-medium">
              Iniciar sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} AppointVa · Agiliza tu negocio</p>
      </div>
    </div>
  );
}
