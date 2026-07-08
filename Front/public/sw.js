const CACHE = "appointva-v4";
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

// ── Fetch (cache strategy) ────────────────────────────────────────────────────

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AppointVa</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#334155}.box{text-align:center;padding:2rem}h1{font-size:1.5rem;font-weight:800;margin-bottom:.5rem}p{color:#64748b;margin-bottom:1.5rem}button{padding:.75rem 1.5rem;background:#334155;color:#fff;border:none;border-radius:.75rem;font-weight:700;cursor:pointer}button:hover{background:#1e293b}</style></head><body><div class="box"><h1>Sin conexión</h1><p>Verifica tu red e intenta de nuevo.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API calls: network-only, no SW interference
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (página completa): network first → index.html cache → offline fallback
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((response) => {
          // Respuesta válida del servidor — la devolvemos tal cual (Render SPA redirect)
          if (response.ok || response.type === "opaqueredirect") return response;
          // Respuesta de error del servidor → sirve index.html de la caché
          return caches.match("/index.html").then(
            (cached) => cached || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html;charset=utf-8" } })
          );
        })
        .catch(() =>
          // Sin red → index.html de caché o pantalla offline
          caches.match("/index.html").then(
            (cached) => cached || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html;charset=utf-8" } })
          )
        )
    );
    return;
  }

  // Assets estáticos: caché primero → red con catch (nunca rechaza)
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone(); // clonar ANTES del gap async
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return response;
        })
        .catch(() => new Response("", { status: 503, statusText: "Service Unavailable" }));
    })
  );
});
