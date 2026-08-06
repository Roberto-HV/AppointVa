# PWA Service Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AppointVa installable como app nativa con carga instantánea en visitas repetidas y una pantalla de "sin conexión" profesional.

**Architecture:** `vite-plugin-pwa` (devDependency) genera el service worker automáticamente desde el build de Vite. Precachea todos los assets estáticos (JS/CSS/HTML/imágenes). Las llamadas a `/api/*` van siempre a red (`NetworkOnly`). Cuando no hay conexión y el usuario navega, el SW sirve `/offline.html` — una página standalone sin React. Un componente `<ErrorConexion />` maneja el estado de error de TanStack Query dentro del dashboard.

**Tech Stack:** Vite 8 / vite-plugin-pwa / Workbox / React 19 / Tailwind CSS / Vitest

## Global Constraints

- `vite-plugin-pwa` se instala como **devDependency** únicamente — sin dependencias runtime nuevas
- El service worker **nunca** cachea `/api/*`
- `offline.html` debe renderizar sin React ni ningún bundle de Vite (HTML/CSS puro)
- `offline.html` respeta `prefers-color-scheme: dark`
- `<ErrorConexion />` usa clases Tailwind existentes — sin estilos inline ni CSS custom
- Brand color primario: `#C8A961` / hover: `#b8975a`
- Auto-update silencioso — sin prompt al usuario
- TypeScript strict — sin `any`
- Todos los tests en `src/` con Vitest + Testing Library
- Correr tests desde `c:\Cursos\AppointVa\Front` con `npx vitest run`

---

## File Map

| Acción   | Archivo                                      | Responsabilidad                                   |
|----------|----------------------------------------------|---------------------------------------------------|
| Modify   | `Front/public/manifest.json`                 | Cambiar `start_url` de `/dashboard` a `/`         |
| Modify   | `Front/vite.config.ts`                       | Agregar plugin `VitePWA` con Workbox config       |
| Create   | `Front/public/offline.html`                  | Página standalone de sin-conexión                 |
| Create   | `Front/src/components/ErrorConexion.tsx`     | Componente React para errores de query            |
| Create   | `Front/src/components/ErrorConexion.test.tsx`| Tests del componente                              |

---

### Task 1: Instalar vite-plugin-pwa y configurar el service worker

**Files:**
- Modify: `Front/public/manifest.json`
- Modify: `Front/vite.config.ts`

**Interfaces:**
- Produces: build con `dist/sw.js` y `dist/registerSW.js` generados automáticamente

- [ ] **Step 1: Instalar vite-plugin-pwa**

Desde `c:\Cursos\AppointVa\Front`:

```bash
npm install -D vite-plugin-pwa
```

Verificar que aparece en `devDependencies` del `package.json`.

- [ ] **Step 2: Corregir manifest.json**

Contenido completo de `Front/public/manifest.json`:

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

- [ ] **Step 3: Actualizar vite.config.ts**

Reemplazar el contenido completo de `Front/vite.config.ts`:

```ts
import path from "path";
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5048",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules/**", "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/test/", "*.config.*"],
    },
  },
});
```

- [ ] **Step 4: Verificar que el build genera el service worker**

```bash
cd c:\Cursos\AppointVa\Front
npm run build
```

Expected: build exitoso sin errores. Verificar que existen:
- `dist/sw.js`
- `dist/registerSW.js`

```bash
ls dist/sw.js dist/registerSW.js
```

Expected: ambos archivos presentes.

- [ ] **Step 5: Correr suite de tests para verificar que no hay regresiones**

```bash
cd c:\Cursos\AppointVa\Front
npx vitest run
```

Expected: 226/226 tests passing.

- [ ] **Step 6: Commit**

```bash
cd c:\Cursos\AppointVa
git add Front/package.json Front/package-lock.json Front/vite.config.ts Front/public/manifest.json
git commit -m "feat(pwa): instalar vite-plugin-pwa y configurar service worker"
```

---

### Task 2: Crear la página offline

**Files:**
- Create: `Front/public/offline.html`

**Interfaces:**
- Consumes: `vite-plugin-pwa` config de Task 1 (`navigateFallback: '/offline.html'`)
- Produces: página en `public/offline.html` accesible en `/offline.html`

- [ ] **Step 1: Crear `Front/public/offline.html`**

Contenido completo:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sin conexión — AppointVa</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #ffffff;
      --surface: #f9fafb;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #C8A961;
      --accent-hover: #b8975a;
      --link: #374151;
      --icon-bg: rgba(200, 169, 97, 0.12);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --surface: #1e293b;
        --text: #f1f5f9;
        --muted: #94a3b8;
        --border: #334155;
        --link: #cbd5e1;
        --icon-bg: rgba(200, 169, 97, 0.15);
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      padding: 2.5rem 2rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    }

    .logo {
      width: 56px;
      height: 56px;
      border-radius: 0.875rem;
      margin: 0 auto 1.25rem;
      display: block;
    }

    .icon-wrapper {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--icon-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }

    .icon-wrapper svg {
      width: 28px;
      height: 28px;
      stroke: var(--accent);
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    h1 {
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
      color: var(--text);
    }

    p {
      font-size: 0.9375rem;
      color: var(--muted);
      line-height: 1.6;
      margin-bottom: 2rem;
    }

    .btn-primary {
      display: block;
      width: 100%;
      padding: 0.75rem 1.5rem;
      background: var(--accent);
      color: #fff;
      font-size: 0.9375rem;
      font-weight: 600;
      border: none;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: background 0.15s;
      margin-bottom: 1.25rem;
    }

    .btn-primary:hover { background: var(--accent-hover); }

    .links {
      display: flex;
      justify-content: center;
      gap: 1.75rem;
      font-size: 0.875rem;
    }

    .links a {
      color: var(--link);
      text-decoration: none;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1px;
      transition: color 0.15s, border-color 0.15s;
    }

    .links a:hover {
      color: var(--accent);
      border-color: var(--accent);
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/IconApp.png" alt="AppointVa" class="logo" onerror="this.style.display='none'" />
    <div class="icon-wrapper">
      <!-- wifi-off icon (lucide) -->
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
        <line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    </div>
    <h1>Sin conexión</h1>
    <p>Revisa tu conexión a internet e intenta de nuevo.</p>
    <button class="btn-primary" onclick="window.location.reload()">Reintentar</button>
    <div class="links">
      <a href="/">Ir al inicio</a>
      <a href="/login">Iniciar sesión</a>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Verificar la página en el navegador**

Con el dev server corriendo (`npm run dev` en `c:\Cursos\AppointVa\Front`), abrir:

```
http://localhost:5173/offline.html
```

Verificar:
- Se muestra el ícono wifi-off en círculo dorado
- Headline "Sin conexión" visible
- Botón "Reintentar" con color `#C8A961`
- Links "Ir al inicio" e "Iniciar sesión" visibles
- Cambiar el tema del OS a oscuro y verificar que los colores cambian correctamente

- [ ] **Step 3: Commit**

```bash
cd c:\Cursos\AppointVa
git add Front/public/offline.html
git commit -m "feat(pwa): página offline profesional con dark mode"
```

---

### Task 3: Componente ErrorConexion

**Files:**
- Create: `Front/src/components/ErrorConexion.tsx`
- Create: `Front/src/components/ErrorConexion.test.tsx`

**Interfaces:**
- Consumes: `lucide-react` (ya instalado), Tailwind CSS (ya configurado)
- Produces:
  ```tsx
  // Front/src/components/ErrorConexion.tsx
  export default function ErrorConexion(props: { refetch: () => void; mensaje?: string }): JSX.Element
  ```

- [ ] **Step 1: Escribir el test primero**

Crear `Front/src/components/ErrorConexion.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ErrorConexion from './ErrorConexion';

describe('ErrorConexion', () => {
  it('muestra el título y mensaje por defecto', () => {
    render(<ErrorConexion refetch={vi.fn()} />);
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByText(/No se pudo cargar la información/)).toBeInTheDocument();
  });

  it('muestra un mensaje personalizado cuando se pasa el prop', () => {
    render(<ErrorConexion refetch={vi.fn()} mensaje="Error al cargar clientes" />);
    expect(screen.getByText('Error al cargar clientes')).toBeInTheDocument();
  });

  it('llama a refetch al hacer clic en Reintentar', async () => {
    const refetch = vi.fn();
    render(<ErrorConexion refetch={refetch} />);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
cd c:\Cursos\AppointVa\Front
npx vitest run src/components/ErrorConexion.test.tsx
```

Expected: FAIL — "Cannot find module './ErrorConexion'"

- [ ] **Step 3: Crear el componente**

Crear `Front/src/components/ErrorConexion.tsx`:

```tsx
import { WifiOff } from 'lucide-react';

interface Props {
  refetch: () => void;
  mensaje?: string;
}

export default function ErrorConexion({ refetch, mensaje }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
        <WifiOff className="w-7 h-7 text-amber-500 dark:text-amber-400" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Sin conexión
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
        {mensaje ?? 'No se pudo cargar la información. Revisa tu conexión.'}
      </p>
      <button
        onClick={refetch}
        className="px-5 py-2.5 bg-[#C8A961] hover:bg-[#b8975a] text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
cd c:\Cursos\AppointVa\Front
npx vitest run src/components/ErrorConexion.test.tsx
```

Expected: 3/3 PASS

- [ ] **Step 5: Correr la suite completa**

```bash
npx vitest run
```

Expected: 229/229 tests passing (226 previos + 3 nuevos).

- [ ] **Step 6: Commit**

```bash
cd c:\Cursos\AppointVa
git add Front/src/components/ErrorConexion.tsx Front/src/components/ErrorConexion.test.tsx
git commit -m "feat(pwa): componente ErrorConexion para errores de query sin red"
```
