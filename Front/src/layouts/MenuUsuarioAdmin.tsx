import { LogOut, Moon, ShieldCheck, Sun, UserCircle } from "lucide-react";
import { inicialesDe } from "../utils/iniciales";

interface Props {
  usuario: { fotoUrl?: string | null; nombreCompleto: string; email: string } | null;
  onCuenta: () => void;
  onSeguridad: () => void;
  onCerrarSesion: () => void;
  theme: "light" | "dark";
  onAlternarTema: () => void;
}

const ITEM =
  "w-full flex items-center gap-2.5 px-4 min-h-[44px] lg:min-h-[40px] text-sm text-slate-600 dark:text-slate-300 " +
  "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-700/50";

/**
 * Contenido del menú de usuario del admin (Lote 1, G1). Mismo aspecto que el
 * del panel (`UserMenuContent` en DashboardLayout): identidad arriba, Mi cuenta,
 * Seguridad, tema y Cerrar sesión separado al final.
 */
export default function MenuUsuarioAdmin({ usuario, onCuenta, onSeguridad, onCerrarSesion, theme, onAlternarTema }: Props) {
  return (
    <div className="py-1">
      <div className="px-4 pt-3 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-600 dark:ring-1 dark:ring-white/25 flex items-center justify-center shrink-0 overflow-hidden">
          {usuario?.fotoUrl
            ? <img src={usuario.fotoUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-white">{inicialesDe(usuario?.nombreCompleto)}</span>}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{usuario?.nombreCompleto}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{usuario?.email}</p>
          <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-transparent border-[1.5px] border-purple-700/40 text-purple-700 dark:border-purple-300/40 dark:text-purple-300">
            Super Admin
          </span>
        </div>
      </div>
      <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3 my-1" />
      <button type="button" onClick={onCuenta} className={ITEM}>
        <UserCircle size={15} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
        Mi cuenta
      </button>
      <button type="button" onClick={onSeguridad} className={ITEM}>
        <ShieldCheck size={15} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
        Seguridad
      </button>
      <button type="button" onClick={onAlternarTema} className={ITEM}>
        {theme === "dark"
          ? <Sun size={15} className="text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
          : <Moon size={15} className="text-slate-400 shrink-0" aria-hidden="true" />}
        {theme === "dark" ? "Modo claro" : "Modo oscuro"}
      </button>
      <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3 my-1" />
      <button
        type="button"
        onClick={onCerrarSesion}
        className="w-full flex items-center gap-2.5 px-4 min-h-[44px] lg:min-h-[40px] text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition focus-visible:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-900/20"
      >
        <LogOut size={15} className="shrink-0" aria-hidden="true" />
        Cerrar sesión
      </button>
      <div className="h-2" />
    </div>
  );
}
