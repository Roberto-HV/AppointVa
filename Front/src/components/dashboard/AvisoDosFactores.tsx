import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, X } from "lucide-react";
import { authApi } from "../../api/auth";

// Decisión 9 (DC-29): la verificación en dos pasos sigue siendo opcional, pero
// se le recomienda al propietario mientras no la tenga. El aviso no bloquea y se
// puede descartar; el descarte se recuerda solo en este navegador.

const clave = (usuarioId: string) => `appointva-aviso-2fa-descartado:${usuarioId}`;

function leerDescartado(usuarioId: string): boolean {
  try {
    return localStorage.getItem(clave(usuarioId)) === "1";
  } catch {
    return false;
  }
}

export default function AvisoDosFactores({ usuarioId }: { usuarioId: string }) {
  const [descartado, setDescartado] = useState(() => leerDescartado(usuarioId));
  const { data: estado } = useQuery({
    queryKey: ["2fa-estado"],
    queryFn: authApi.obtenerEstado2FA,
    staleTime: 1000 * 60,
    enabled: !descartado,
  });

  if (descartado || !estado || estado.habilitado) return null;

  const descartar = () => {
    setDescartado(true);
    try {
      localStorage.setItem(clave(usuarioId), "1");
    } catch {
      // Sin almacenamiento el aviso vuelve en la próxima visita; no pasa nada.
    }
  };

  return (
    <section
      aria-labelledby="aviso-2fa-titulo"
      className="mb-6 flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-4"
    >
      <ShieldCheck size={20} className="mt-0.5 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 id="aviso-2fa-titulo" className="text-sm font-semibold text-foreground">
          Protege tu negocio con la verificación en dos pasos
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Además de tu contraseña, se te pedirá un código de tu teléfono al iniciar sesión. Si alguien obtiene tu contraseña, no podrá entrar a tu panel.
        </p>
        <Link
          to="/dashboard/seguridad"
          className="mt-2 inline-flex min-h-[44px] lg:min-h-[36px] items-center rounded-xl bg-slate-700 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Activar ahora
        </Link>
      </div>
      <button
        type="button"
        onClick={descartar}
        aria-label="Descartar el aviso de verificación en dos pasos"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </section>
  );
}
