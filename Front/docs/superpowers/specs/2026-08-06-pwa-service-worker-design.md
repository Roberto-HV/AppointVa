# PWA Service Worker — Design Spec

## Goal

Make AppointVa installable as a native-like app on mobile and desktop, with fast repeat loads via asset caching and a professional offline experience when there is no network connection.

## Architecture

Single dependency: `vite-plugin-pwa` (wraps Workbox). The plugin auto-generates `sw.js` and `registerSW.js` from the Vite build manifest. No changes to `main.tsx` or `index.html` beyond what the plugin injects automatically.

**Tech Stack:** Vite 5 / vite-plugin-pwa / Workbox / React 19 / Tailwind CSS

---

## Global Constraints

- No new npm runtime dependencies beyond `vite-plugin-pwa` (devDependency)
- The service worker must never cache `/api/*` responses
- `offline.html` must load without React or any Vite bundle (pure HTML/CSS)
- Dark/light mode: `offline.html` respects `prefers-color-scheme`; `<ErrorConexion />` respects the app's existing Tailwind dark mode
- Brand color: `#C8A961`
- Auto-update: silent (no user prompt)
- TypeScript strict — no `any`

---

## Section 1: manifest.json fix

Change `start_url` from `/dashboard` to `/`.

**Reason:** an installed app opened while logged out would hit `/dashboard`, get a 401, and redirect to login — confusing. Starting at `/` lets the router handle auth redirect cleanly.

**File:** `Front/public/manifest.json`

```json
{
  "name": "AppointVa",
  "short_name": "AppointVa",
  "description": "Sistema de gestión de citas para negocios de servicios",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#C8A961",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "/IconApp.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/IconApp.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["business", "productivity"]
}
```

---

## Section 2: vite-plugin-pwa configuration

**File:** `Front/vite.config.ts`

Add `VitePWA` plugin with:

```ts
VitePWA({
  registerType: 'autoUpdate',          // silent update — SW takes control on next navigation
  injectRegister: 'auto',              // injects registerSW.js automatically
  manifest: false,                     // use existing public/manifest.json, don't generate a new one
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    navigateFallback: '/offline.html', // shown when SW intercepts a navigation with no cache hit
    navigateFallbackDenylist: [/^\/api/],  // never intercept API routes
    runtimeCaching: [
      {
        // Static images — serve from cache immediately, revalidate in background
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 } },
      },
      {
        // API calls — always try network first; on failure, do NOT serve stale data
        urlPattern: /^https?:\/\/.*\/api\//,
        handler: 'NetworkOnly',
      },
    ],
  },
})
```

**Why `NetworkOnly` for API (not `NetworkFirst`):** `NetworkFirst` would cache the last successful response and serve it on failure — meaning a user could see stale appointment data silently. `NetworkOnly` lets TanStack Query handle the error state, which triggers `<ErrorConexion />`.

---

## Section 3: Offline page

**File:** `Front/public/offline.html`

Standalone HTML/CSS page. No React, no Vite bundle dependency — it must render even if all JS bundles fail to load.

**Design requirements:**
- AppointVa logo/icon (`/IconApp.png`)
- Headline: "Sin conexión"
- Subtext: "Revisa tu conexión a internet e intenta de nuevo."
- Primary button: "Reintentar" → `window.location.reload()`
- Secondary links: "Ir al inicio" (`/`) and "Iniciar sesión" (`/login`)
- Respects `prefers-color-scheme: dark`
- Brand color `#C8A961` for the primary button
- Centered layout, max-width 400px, system font stack

---

## Section 4: ErrorConexion component

**File:** `Front/src/components/ErrorConexion.tsx`

Reusable React component for use inside dashboard pages when a `useQuery` returns `isError` due to network failure.

```tsx
interface Props {
  refetch: () => void;
  mensaje?: string;
}
```

**Design:**
- Icon: wifi-off (lucide-react `WifiOff`)
- Headline: "Sin conexión"
- Subtext: `mensaje` prop or default "No se pudo cargar la información. Revisa tu conexión."
- Button: "Reintentar" → calls `refetch()`
- Centered, `text-gray-500 dark:text-gray-400` palette, consistent with existing empty-state patterns in the app

**Usage pattern** (not part of this task — component is provided; adoption in individual pages is a follow-up):
```tsx
if (isError) return <ErrorConexion refetch={refetch} />;
```

---

## Section 5: Update behavior

`registerType: 'autoUpdate'` means:
- On first visit: SW installs and takes control immediately
- On new deploy: SW detects update in background, waits for all tabs to close, then activates silently
- No banner, no prompt, no user action required

This is correct for a business dashboard where users naturally close/reopen the app between sessions.

---

## Out of scope

- Offline data sync (appointments, payments) — requires bidirectional sync, IndexedDB, conflict resolution
- Push notifications — separate feature, separate spec
- Background sync for form submissions
- Adoption of `<ErrorConexion />` in individual pages — follow-up task after component is created
