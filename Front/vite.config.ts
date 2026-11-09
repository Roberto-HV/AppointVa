import path from "path";
import { searchForWorkspaceRoot } from 'vite';
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
        // Sin webp a propósito: las portadas de materiales (public/portadas) pesan
        // en total casi 1 MB y cada negocio usa una sola; las cachea la regla de
        // imágenes de abajo cuando de verdad se piden.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Los handlers de push viven fuera del worker generado porque Workbox
        // reescribe sw.js en cada build. La ruta se emite tal cual en el
        // importScripts() del worker, así que apunta a public/push-sw.js.
        importScripts: ['/push-sw.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Workbox evalúa las rutas en orden de registro: /api/ va primero para
        // que una respuesta de API que termine en extensión de imagen no acabe
        // guardada en la caché `images`.
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkOnly',
          },
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
    // Only under Vitest: the receipt's golden vectors live with the backend tests
    // (Back/AppointVaAPI/AppointVaAPI.Tests/Fixtures) and both suites read them.
    ...(process.env.VITEST
      ? {
          fs: {
            allow: [
              searchForWorkspaceRoot(process.cwd()),
              path.resolve(__dirname, "../Back/AppointVaAPI/AppointVaAPI.Tests/Fixtures"),
            ],
          },
        }
      : {}),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules/**", "e2e/**"],
    // Under parallel jsdom load a test that runs in ~300ms alone can exceed the
    // 5s default; the higher limit tolerates slowness without hiding failures.
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/test/", "*.config.*"],
    },
  },
});
