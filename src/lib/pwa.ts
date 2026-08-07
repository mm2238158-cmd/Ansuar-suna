/**
 * Guarded service worker registration.
 * The worker must never register in dev, inside an iframe, or on any Lovable
 * preview host — a stale app shell there would serve deleted chunks.
 */

const SW_URL = "/sw.js";

const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const shouldRefuse = () => {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  if (window.self !== window.top) return true;
  if (isPreviewHost(window.location.hostname)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
};

const unregisterAppWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((reg) => {
        const scriptURL = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
        return scriptURL.endsWith(SW_URL);
      })
      .map((reg) => reg.unregister())
  );
};

export const registerServiceWorker = () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (shouldRefuse()) {
    void unregisterAppWorkers();
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch((err) => {
      console.warn("[pwa] service worker registration failed", err);
    });
  });
};
