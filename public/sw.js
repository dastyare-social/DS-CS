const CACHE_NAME = "dastyare-social-v1";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
  "/favicon.ico",
  "/profile-image.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigations: network-first, fall back to the cached app shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then(async (cache) => {
            const cached = await cache.match(request);
            if (cached) return cached;
            const shell = await cache.match("/");
            return shell || Response.error();
          }),
        ),
    );
    return;
  }

  // Same-origin GET requests: stale-while-revalidate
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "New update";
  const options = {
    body: data.body || "A new update is available",
    icon: data.icon || "/profile-image.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
