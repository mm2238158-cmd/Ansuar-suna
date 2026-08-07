import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ["**/*.{js,css,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/__/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              (request.destination === "script" ||
                request.destination === "style" ||
                request.destination === "font") &&
              url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
