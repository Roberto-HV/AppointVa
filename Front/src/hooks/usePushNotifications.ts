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

    // Obtener la VAPID public key desde el backend (no es secreta, puede ser anónima)
    meApi.obtenerVapidPublicKey().then((key) => {
      vapidKey.current = key;
    });
  }, [soportado]);

  const activar = useCallback(async () => {
    if (!soportado) return;

    // Si la key aún no llegó, intentar obtenerla ahora
    if (!vapidKey.current) {
      vapidKey.current = await meApi.obtenerVapidPublicKey();
    }
    if (!vapidKey.current) {
      console.error("VAPID public key no disponible. Verifica Push__VapidPublicKey en Render.");
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
      console.error("Error activando push:", err);
    } finally {
      setCargando(false);
    }
  }, [soportado]);

  const desactivar = useCallback(async () => {
    if (!soportado) return;
    setCargando(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      await meApi.eliminarPushSuscripcion();
      setSuscrito(false);
    } catch (err) {
      console.error("Error desactivando push:", err);
    } finally {
      setCargando(false);
    }
  }, [soportado]);

  return { permiso, suscrito, soportado, cargando, activar, desactivar };
}
