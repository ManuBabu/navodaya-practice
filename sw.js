const CACHE = "navodaya-v10";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/mat.js", "/icon-sky-192.png", "/icon-sky-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // network first so new questions and app updates show up; cache when offline
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && !url.pathname.startsWith("/api/")) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("/")))
  );
});
