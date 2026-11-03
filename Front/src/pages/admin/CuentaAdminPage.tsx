import EncabezadoPagina from "../../components/ui/EncabezadoPagina";
import CambiarContrasena from "../../components/cuenta/CambiarContrasena";
import AvisoDosFactores from "../../components/dashboard/AvisoDosFactores";
import { useAuthStore } from "../../store/authStore";
import { useTituloPagina } from "../../hooks/useTituloPagina";
import { inicialesDe } from "../../utils/iniciales";

/**
 * Mi cuenta del SuperAdmin (Lote 1, G1). Antes la cuenta con más poder no
 * tenía dónde cambiar su contraseña ni activar la verificación en dos pasos:
 * las rutas del panel solo admiten Propietario y Empleado. Reutiliza el mismo
 * formulario de Mi perfil y la misma tarjeta de 2FA, que aquí enlaza a
 * /admin/seguridad (la página Seguridad del panel, sin cambios).
 */
export default function CuentaAdminPage() {
  useTituloPagina("Mi cuenta · Admin");
  const usuario = useAuthStore((s) => s.usuario);

  return (
    <div className="p-4 sm:p-8">
      <EncabezadoPagina
        className="mb-6"
        titulo="Mi cuenta"
        subtitulo="Tus datos de acceso y la seguridad de la cuenta de administración"
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <section
          aria-label="Tu cuenta"
          className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 flex flex-col items-center text-center gap-3 w-full lg:w-64 shrink-0"
        >
          <div className="w-20 h-20 rounded-full bg-slate-900 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
            {usuario?.fotoUrl
              ? <img src={usuario.fotoUrl} alt="" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-white">{inicialesDe(usuario?.nombreCompleto)}</span>}
          </div>
          <div className="min-w-0 w-full">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{usuario?.nombreCompleto}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">{usuario?.email}</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full border-[1.5px] border-purple-700/40 text-purple-700 dark:border-purple-300/40 dark:text-purple-300">
            Super Admin
          </span>
        </section>

        <div className="flex-1 min-w-0 w-full">
          <CambiarContrasena />
        </div>
      </div>

      <AvisoDosFactores rutaSeguridad="/admin/seguridad" className="mt-6" />
    </div>
  );
}
