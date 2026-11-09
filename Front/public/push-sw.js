/**
 * Handlers de push para el service worker.
 *
 * Workbox genera `sw.js` (modo generateSW) y lo sobrescribe en cada build, así
 * que estos listeners viven aparte y entran por `workbox.importScripts` en
 * vite.config.ts. Está en `public/` porque Workbox emite la ruta tal cual, sin
 * resolverla ni versionarla: Vite lo copia verbatim a `dist/push-sw.js` y
 * `globPatterns` lo mete en el manifiesto de precaché, así que cambiar este
 * archivo cambia los bytes de `sw.js` y el navegador detecta la actualización.
 *
 * Al ser un archivo estático sin transformar, aquí no existe `import.meta.env`.
 */

self.addEventListener("push", (e) => {
  let data = { title: "AppointVa", body: "Tienes una nueva notificación.", url: "/", icalUrl: null, googleCalUrl: null };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}

  const options = {
    body: data.body,
    data: { url: data.url, icalUrl: data.icalUrl, googleCalUrl: data.googleCalUrl },
  };

  e.waitUntil(
    // El fallback sin `options` es para iOS: ahí la notificación rica llega a
    // fallar y sin esto el navegador muestra el aviso genérico del sistema.
    self.registration.showNotification(data.title, options).catch(() =>
      self.registration.showNotification("AppointVa", { body: data.body })
    )
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const { url, icalUrl, googleCalUrl } = e.notification.data ?? {};

  let target = url ?? "/";
  if (e.action === "ical" && icalUrl)          target = icalUrl;
  else if (e.action === "gcal" && googleCalUrl) target = googleCalUrl;

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (target.startsWith("http") && !target.includes(self.location.origin)) {
        return clients.openWindow(target);
      }
      const existing = list.find((c) => c.url.includes(target));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});
