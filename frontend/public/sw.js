/**
 * Tip Autopsy — Privacy-Safe & Provenance-Disciplined Service Worker (sw.js)
 *
 * Non-negotiable guardrails (AGENTS.md §3.5 & §3.6, DESIGN.md §19.10):
 * 1. NEVER cache or persist any `/api/*` response, user-uploaded photo/video, pasted tip text,
 *    Pause & Plan answers, or WhatsApp subscription payload.
 * 2. NEVER misrepresent cached data as a live market feed.
 * 3. Only cache static application shell assets (.html, .js, .css, fonts, icons, and curated static /media/*).
 */

const CACHE_NAME = "tip-autopsy-static-v2";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/pwa/icon.svg",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
  "/pwa/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 1. Strictly ignore non-GET requests (e.g., POST /api/tips/parse with user media/text)
  if (request.method !== "GET") {
    return;
  }

  // Ignore partial range requests (video streaming slices) so native browser media streaming works cleanly
  if (request.headers.has("range")) {
    return;
  }

  const url = new URL(request.url);

  // 2. Strictly bypass Service Worker cache for all API endpoints to preserve data provenance & privacy
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/webhooks/")) {
    return;
  }

  // Only handle same-origin static assets or Google Fonts stylesheets/font files
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFonts =
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

  if (!isSameOrigin && !isGoogleFonts) {
    return;
  }

  // 3. SPA Navigation requests: Network-first with cached /index.html fallback when phone is offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedShell = (await cache.match("/index.html")) || (await cache.match("/"));
          return (
            cachedShell ||
            new Response("Tip Autopsy is offline. Please reconnect to load the workspace.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        })
    );
    return;
  }

  // 4. Static assets (JS, CSS, fonts, PWA icons, curated demo images): Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === "basic" || networkResponse.type === "cors")
          ) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
