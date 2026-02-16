const CACHE_VERSION = "celstomp-v6";

const APP_SHELL = [ "./", "./index.html", "./celstomp-styles.css", "./celstomp-imgseq.js", "./celstomp-autosave.js", "./celstomp-app.js", "./manifest.webmanifest", "./icons/favicon.ico" ];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_VERSION).then(async c => {
        await Promise.all(APP_SHELL.map(url => c.add(url).catch(() => null)));
    }));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE_VERSION ? null : caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const req = event.request;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
            if (res.ok) {
                const copy = res.clone();
                caches.open(CACHE_VERSION).then(c => c.put(req, copy));
            }
            return res;
        }).catch(() => {
            if (req.mode === "navigate") return caches.match("./index.html");
            throw new Error("Offline and not cached: " + req.url);
        });
    }));
});
