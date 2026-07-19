const CACHE_NAME = "trade-invoice-tracker-v3";
const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/maskable.svg",
  "/icons/apple-touch-icon.png",
  "/guides/iphone-install-share.png",
  "/guides/iphone-install-menu.png",
  "/guides/iphone-install-confirm.png",
  "/guides/iphone-install-launch.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !STATIC_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
