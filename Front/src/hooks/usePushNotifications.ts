import { useCallback, useEffect, useRef, useState } from "react";
import { meApi } from "../api/me";

type PermisoState = "default" | "granted" | "denied" | "unsupported";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function usePushNotifications() {
  const [permiso, setPermiso] = useState<PermisoState>("unsupported");
  const [suscrito, setSuscrito] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vapidKey = useRef<string | null>(null);

  const soportado =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!soportado) return;
    setPermiso(Notification.permission as PermisoState);

    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSuscrito(!!sub))
    );

    meApi.obtenerVapidPublicKey().then((key) => {
      vapidKey.current = key;
    });
  }, [soportado]);

  const activar = useCallback(async () => {
    if (!soportado) return;
    setError(null);

    if (!vapidKey.current) {
      vapidKey.current = await meApi.obtenerVapidPublicKey();
    }
    if (!vapidKey.current) {
      setError("No se pudo obtener la clave VAPID del servidor. Recarga la página e intenta de nuevo.");
      return;
    }

    setCargando(true);
    try {
      const result = await Notification.requestPermission();
      setPermiso(result as PermisoState);
      if (result !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidKey.current),
      });

      const { endpoint, keys } = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      await meApi.guardarPushSuscripcion({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });

      setSuscrito(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Error al activar: ${msg}`);
    } finally {
      setCargando(false);
    }
  }, [soportado]);

  const desactivar = useCallback(async () => {
    if (!soportado) return;
    setError(null);
    setCargando(true);
    let browserUnsubscribed = false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      browserUnsubscribed = true;
      await meApi.eliminarPushSuscripcion();
      setSuscrito(false);
    } catch (err) {
      // Si el navegador ya lo desuscribió, actualizamos la UI de todos modos
      if (browserUnsubscribed) setSuscrito(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Error al desactivar: ${msg}`);
    } finally {
      setCargando(false);
    }
  }, [soportado]);

  return { permiso, suscrito, soportado, cargando, error, setError, activar, desactivar };
}
