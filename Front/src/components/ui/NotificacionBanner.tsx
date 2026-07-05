import { Bell, BellOff, X } from "lucide-react";
import { useState } from "react";
import { meApi } from "../../api/me";
import { usePushNotifications } from "../../hooks/usePushNotifications";

interface Props {
  /** Si es false, el banner nunca se muestra (e.g. para propietarios) */
  visible?: boolean;
}

export function NotificacionBanner({ visible = true }: Props) {
  const { permiso, suscrito, soportado, cargando, activar } = usePushNotifications();
  const [descartado, setDescartado] = useState(false);

  // No mostrar si: no soporta push, ya aceptó, ya está suscrito, descartó o no es visible
  if (!visible || !soportado || suscrito || descartado) return null;
  // Si ya bloqueó, no mostrar el banner suave (se muestra en perfil)
  if (permiso === "denied" || permiso === "granted") return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">
          Activa las notificaciones de citas
        </p>
        <p className="mt-0.5 text-xs text-blue-700">
          Recibe alertas al instante cuando te asignen una nueva cita, sin tener que revisar el panel.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={activar}
            disabled={cargando}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {cargando ? "Activando…" : "Activar notificaciones"}
          </button>
          <button
            onClick={() => setDescartado(true)}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Ahora no
          </button>
        </div>
      </div>
      <button
        onClick={() => setDescartado(true)}
        className="text-blue-400 hover:text-blue-600"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Sección para la página de perfil — muestra el estado actual y permite activar/desactivar */
export function NotificacionPerfilSection() {
  const { permiso, suscrito, soportado, cargando, activar, desactivar } =
    usePushNotifications();
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<string | null>(null);

  const probar = async () => {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      await meApi.probarPushNotificacion();
      setResultadoPrueba("Notificación enviada — revisa tu dispositivo.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data
          ?.mensaje ?? "Error al enviar la prueba.";
      setResultadoPrueba(msg);
    } finally {
      setProbando(false);
    }
  };

  if (!soportado) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Tu navegador no soporta notificaciones push.
      </div>
    );
  }

  if (permiso === "denied") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Notificaciones bloqueadas en el navegador
            </p>
            <p className="mt-1 text-xs text-amber-800">Para activarlas:</p>
            <ol className="mt-1 list-decimal pl-4 text-xs text-amber-800 space-y-0.5">
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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {suscrito ? (
            <Bell className="h-5 w-5 text-green-600" />
          ) : (
            <BellOff className="h-5 w-5 text-gray-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {suscrito ? "Notificaciones activas" : "Notificaciones desactivadas"}
            </p>
            <p className="text-xs text-gray-500">
              {suscrito
                ? "Recibirás alertas cuando te asignen una nueva cita."
                : "Actívalas para saber de tus citas al instante."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {suscrito && (
            <button
              onClick={probar}
              disabled={probando}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {probando ? "Enviando…" : "Probar"}
            </button>
          )}
          <button
            onClick={suscrito ? desactivar : activar}
            disabled={cargando}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
              suscrito
                ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {cargando ? "…" : suscrito ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>
      {resultadoPrueba && (
        <p className="mt-2 text-xs text-gray-500">{resultadoPrueba}</p>
      )}
    </div>
  );
}
