import { Bell, BellOff, X } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

interface Props {
  /** Si es false, el banner nunca se muestra (e.g. para propietarios) */
  visible?: boolean;
}

export function NotificacionBanner({ visible = true }: Props) {
  const { permiso, suscrito, soportado, cargando, error, activar } = usePushNotifications();
  const [descartado, setDescartado] = useState(false);

  // No mostrar si: no soporta push, ya está suscrito, descartó o no es visible
  if (!visible || !soportado || suscrito || descartado) return null;
  // Si ya bloqueó, no mostrar el banner suave (se muestra en perfil)
  if (permiso === "denied") return null;
  // Si ya tiene permiso y NO está en medio de la activación, no mostrar el banner
  if (permiso === "granted" && !cargando && !error) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Activa las notificaciones de citas
        </p>
        <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
          Recibe alertas al instante cuando te asignen una nueva cita, sin tener que revisar el panel.
        </p>
        {error && (
          <p className="mt-2 text-xs text-red-700 dark:text-red-400" role="alert">{error}</p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            onClick={activar}
            disabled={cargando}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {cargando ? "Activando…" : "Activar notificaciones"}
          </button>
          {!cargando && (
            <button
              onClick={() => setDescartado(true)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            >
              Ahora no
            </button>
          )}
        </div>
      </div>
      <button
        onClick={() => setDescartado(true)}
        className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
        aria-label="Cerrar aviso de notificaciones"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Sección para la página de perfil — muestra el estado actual y permite activar/desactivar */
export function NotificacionPerfilSection() {
  const { permiso, suscrito, soportado, cargando, error, setError, activar, desactivar } =
    usePushNotifications();

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    ((window.navigator as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches);
  const needsPWA = isIOS && !isStandalone && !suscrito;

  if (!soportado) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-800 p-4 text-sm text-gray-500 dark:text-gray-400">
        Tu navegador no soporta notificaciones push.
      </div>
    );
  }

  if (needsPWA) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Abre la app desde la pantalla de inicio
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Las notificaciones push solo funcionan cuando usas AppointVa desde el ícono instalado en tu pantalla de inicio, no desde Safari.
            </p>
            <ol className="mt-2 list-decimal pl-4 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
              <li>Cierra esta pestaña de Safari</li>
              <li>Busca el ícono de AppointVa en tu pantalla de inicio</li>
              <li>Ábrelo desde ahí y regresa aquí</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (permiso === "denied") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Notificaciones bloqueadas en el navegador
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Para activarlas:</p>
            <ol className="mt-1 list-decimal pl-4 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">
              <li>Toca el icono del candado 🔒 en la barra de URL</li>
              <li>Selecciona <strong>Notificaciones → Permitir</strong></li>
              <li>Recarga la página</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {suscrito ? (
            <Bell className="h-5 w-5 text-green-600" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {suscrito ? "Notificaciones activas" : "Notificaciones desactivadas"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {suscrito
                ? "Recibirás alertas cuando te asignen una nueva cita."
                : "Actívalas para saber de tus citas al instante."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={suscrito ? desactivar : activar}
            disabled={cargando}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
              suscrito
                ? "border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {cargando ? "…" : suscrito ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 px-3 py-2" role="alert">
          <span className="text-xs text-red-700 dark:text-red-300 flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Cerrar mensaje de error" className="text-red-600 dark:text-red-300 hover:text-red-800 text-xs leading-none mt-0.5">✕</button>
        </div>
      )}
    </div>
  );
}
