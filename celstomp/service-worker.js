const CACHE_VERSION = "celstomp-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./celstomp-styles.css",
  "./celstomp-imgseq.js",
  "./celstomp-app.js",
  "./manifest.webmanifest",

  // favicons / app icons you referenced
  "./icons/favicon.ico",
  "./icons/favicon-16x16.png",
  "./icons/favicon-32x32.png",
  "./icons/apple-touch-icon.png",
  "./icons/android-chrome-192x192.png",
  "./icons/android-chrome-512x512.png",
];

self.addEventListener("install", (event) => {
  // Pre-cache the app shell, but don't fail install if an optional asset 404s.
  // (Missing icons/fonts shouldn't brick offline support.)
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (c) => {
      await Promise.all(APP_SHELL.map((url) => c.add(url).catch(() => null)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // only cache your own files (same-origin)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => {
          // offline fallback for page navigations
          if (req.mode === "navigate") return caches.match("./index.html");
          throw new Error("Offline and not cached: " + req.url);
        });
    })
  );
});
