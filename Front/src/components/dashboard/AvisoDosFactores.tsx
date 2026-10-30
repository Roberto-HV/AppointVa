import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Shield, ShieldCheck } from "lucide-react";
import { authApi } from "../../api/auth";
import { quedanPocosCodigos } from "../../utils/codigosRecuperacion";

// La verificación en dos pasos se configura en un solo lugar: la página
// Seguridad. Mi perfil la menciona una sola vez, en esta tarjeta, que dice el
// estado y enlaza allá. Antes había además un banner arriba de Mi perfil con el
// mismo mensaje, así que la misma tarea aparecía en tres sitios.
//
// Decisión 9 (DC-29): sigue siendo opcional, pero se le recomienda al
// propietario mientras no la tenga. Ya no hace falta descartarla: es una fila
// de ajustes, no un banner que tape la página.
// B8: con 2FA activo, avisa aquí mismo cuando quedan pocos códigos de recuperación.

const CLASE_ENLACE_PRIMARIO =
  "inline-flex items-center justify-center min-h-[44px] lg:min-h-[36px] px-4 rounded-xl bg-slate-700 text-sm font-semibold text-white " +
  "hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CLASE_ENLACE_SECUNDARIO =
  "inline-flex items-center justify-center min-h-[44px] lg:min-h-[36px] px-4 rounded-xl border border-border text-sm font-medium text-foreground " +
  "hover:bg-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Props {
  /** El propietario recibe la recomendación con el porqué para su negocio. */
  esPropietario?: boolean;
  className?: string;
}

export default function AvisoDosFactores({ esPropietario = false, className = "" }: Props) {
  const { data: estado } = useQuery({
    queryKey: ["2fa-estado"],
    queryFn: authApi.obtenerEstado2FA,
    staleTime: 1000 * 60,
  });

  const restantes = estado?.codigosRecuperacionRestantes ?? 0;
  const pocosCodigos = !!estado?.habilitado && quedanPocosCodigos(restantes);

  let Icono = Shield;
  let descripcion = "Verificación en dos pasos para proteger tu cuenta.";
  let enlace = { texto: "Configurar verificación en dos pasos", primario: false };
  let alerta = false;

  if (estado && !estado.habilitado) {
    descripcion = esPropietario
      ? "Desactivada. Actívala para proteger tu negocio: además de tu contraseña, se pedirá un código de tu teléfono al iniciar sesión."
      : "Desactivada. Actívala para que, además de tu contraseña, se pida un código de tu teléfono al iniciar sesión.";
    enlace = { texto: "Activar verificación en dos pasos", primario: true };
  } else if (pocosCodigos) {
    Icono = KeyRound;
    alerta = true;
    descripcion = restantes === 0
      ? "Activada, pero ya no te quedan códigos de recuperación. Si pierdes el teléfono, son tu única forma de entrar."
      : `Activada. Te ${restantes === 1 ? "queda 1 código" : `quedan ${restantes} códigos`} de recuperación: genera nuevos y guárdalos en un lugar seguro.`;
    enlace = { texto: "Generar códigos nuevos", primario: true };
  } else if (estado?.habilitado) {
    Icono = ShieldCheck;
    descripcion = "Activada. Se pide un código de tu teléfono al iniciar sesión.";
    enlace = { texto: "Administrar", primario: false };
  }

  return (
    <section
      aria-labelledby="seguridad-titulo"
      className={`bg-white dark:bg-slate-800 rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3 ${
        alerta ? "border-amber-200 dark:border-amber-800" : "border-slate-100 dark:border-slate-700"
      } ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1 basis-64">
        <Icono
          size={20}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 ${alerta ? "text-amber-700 dark:text-amber-300" : "text-slate-500 dark:text-slate-400"}`}
        />
        <div className="min-w-0">
          <h2 id="seguridad-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Verificación en dos pasos
          </h2>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      <Link
        to="/dashboard/seguridad"
        className={enlace.primario ? CLASE_ENLACE_PRIMARIO : CLASE_ENLACE_SECUNDARIO}
      >
        {enlace.texto}
      </Link>
    </section>
  );
}
