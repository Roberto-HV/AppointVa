const CACHE = "appointva-v2";
const STATIC = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (e) => {
  let data = { title: "AppointVa", body: "Tienes una nueva notificación.", url: "/", icalUrl: null, googleCalUrl: null };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}

  // iOS no soporta action buttons (Notification.maxActions === 0 o undefined)
  const maxActions = (self.Notification && self.Notification.maxActions) || 0;
  const actions = [];
  if (maxActions > 0) {
    if (data.icalUrl)      actions.push({ action: "ical",   title: "📅 Al calendario" });
    if (data.googleCalUrl) actions.push({ action: "gcal",   title: "📆 Google Calendar" });
    actions.push(            { action: "ver",    title: "Ver cita" });
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    data: { url: data.url, icalUrl: data.icalUrl, googleCalUrl: data.googleCalUrl },
  };
  if (actions.length > 0) options.actions = actions;

  // Fallback: si showNotification falla por opciones no soportadas, muestra notif mínima
  e.waitUntil(
    self.registration.showNotification(data.title, options).catch(() =>
      self.registration.showNotification(data.title, { body: data.body })
    )
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const { url, icalUrl, googleCalUrl } = e.notification.data ?? {};

  let target = url ?? "/";
  if (e.action === "ical" && icalUrl)         target = icalUrl;
  else if (e.action === "gcal" && googleCalUrl) target = googleCalUrl;

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Para URLs externas (gcal/ical) siempre abrir nueva ventana
      if (target.startsWith("http") && !target.includes(self.location.origin)) {
        return clients.openWindow(target);
      }
      const existing = list.find((c) => c.url.includes(target));
      if (existing) return existing.focus();
      return clients.openWindow(target);
    })
  );
});

// ── Fetch (cache strategy) ────────────────────────────────────────────────────

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API calls: network-only
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network first, fallback to index.html (SPA)
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: cache first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return response;
      });
    })
  );
});
