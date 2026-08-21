// Service worker — push notifications + offline caching via Cache API + IndexedDB.
// Runs in production on Vercel (Turbopack does not run @serwist/next's webpack plugin).

// ---------------------------------------------------------------------------
// Cache names
// ---------------------------------------------------------------------------
const TRPC_CACHE = "trpc-cache-v1";
const STATIC_CACHE = "static-cache-v1";
const PAGE_CACHE = "page-cache-v1";
const MEDIA_CACHE = "media-cache-v1";

// ---------------------------------------------------------------------------
// IndexedDB helpers (inline — SW can't use ES modules)
// ---------------------------------------------------------------------------
const IDB_NAME = "ds-cs-offline";
const IDB_VERSION = 1;
const POSTS_STORE = "posts";

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(POSTS_STORE)) {
        const store = db.createObjectStore(POSTS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(post) {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readwrite");
        tx.objectStore(POSTS_STORE).put(post);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbPutAll(posts) {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readwrite");
        const store = tx.objectStore(POSTS_STORE);
        for (const post of posts) store.put(post);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbGetAll() {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readonly");
        const req = tx.objectStore(POSTS_STORE).index("createdAt").getAll();
        req.onsuccess = () => resolve(req.result.reverse());
        req.onerror = () => reject(req.error);
      })
  );
}

function idbGet(id) {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readonly");
        const req = tx.objectStore(POSTS_STORE).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function idbDelete(id) {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readwrite");
        tx.objectStore(POSTS_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

// ---------------------------------------------------------------------------
// Extract posts from tRPC response and store in IndexedDB
// ---------------------------------------------------------------------------
function extractPostsFromResponse(data) {
  if (!data || typeof data !== "object") return [];

  // tRPC responses: { result: { data: { items: [...], ... } } }
  const items =
    data?.result?.data?.items ??
    data?.result?.data ??
    (Array.isArray(data?.result?.data) ? data.result.data : null);

  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];

  return arr
    .filter((p) => p && p.id)
    .map((p) => ({
      id: p.id,
      type: p.type || "text",
      content: p.content || null,
      media: p.media || null,
      reactions: p.reactions || [],
      views: p.views || "0",
      pinnedAt: p.pinnedAt || null,
      createdAt: p.createdAt || null,
      updatedAt: p.updatedAt || null,
      _cachedAt: Date.now(),
    }));
}

function cachePostsInIDB(posts) {
  if (!posts.length) return Promise.resolve();
  return idbPutAll(posts).catch(() => {});
}

// ---------------------------------------------------------------------------
// Extract media URLs from posts and cache in Cache API
// ---------------------------------------------------------------------------
function extractMediaUrls(post) {
  const urls = [];
  const m = post.media;
  if (!m) return urls;

  if (m.url) urls.push(m.url);
  if (m.thumbnail) urls.push(m.thumbnail);

  // If media is an array (multiple images/videos)
  if (Array.isArray(m)) {
    for (const item of m) {
      if (item?.url) urls.push(item.url);
      if (item?.thumbnail) urls.push(item.thumbnail);
    }
  }

  return urls;
}

function cacheMediaInCacheAPI(urls) {
  if (!urls.length) return Promise.resolve();
  return caches.open(MEDIA_CACHE).then((cache) =>
    Promise.allSettled(
      urls.map((url) =>
        fetch(url)
          .then((resp) => {
            if (resp.ok) return cache.put(url, resp);
          })
          .catch(() => {})
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
const SHELL_URLS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.endsWith("-dev")).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Media files (images, video, audio): cache-first, store in IDB too
  if (
    url.pathname.startsWith("/api/media/") ||
    url.pathname.startsWith("/animated-emojies/") ||
    /\.(png|jpe?g|webp|gif|svg|mp4|webm|mp3|ogg|wav|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(MEDIA_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // tRPC API: network-first, store posts in IDB + media in cache
  if (url.pathname.startsWith("/api/trpc/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          // Parse and cache in background
          clone
            .json()
            .then((data) => {
              const posts = extractPostsFromResponse(data);
              if (posts.length) {
                cachePostsInIDB(posts);
                // Cache media URLs from posts
                const mediaUrls = posts.flatMap(extractMediaUrls);
                if (mediaUrls.length) cacheMediaInCacheAPI(mediaUrls);
              }
            })
            .catch(() => {});
          // Also cache the raw response for Cache API fallback
          caches.open(TRPC_CACHE).then((cache) => {
            const rawClone = response.clone();
            cache.put(event.request, rawClone);
          });
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } }))
        )
    );
    return;
  }

  // Navigation requests: network-first → cache → IDB → offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) =>
              cached ||
              caches.match("/").then(
                (home) =>
                  home ||
                  new Response(offlineHTML(), {
                    status: 200,
                    headers: { "Content-Type": "text/html; charset=utf-8" },
                  })
              )
          )
        )
    );
    return;
  }
});

// ---------------------------------------------------------------------------
// Offline fallback HTML
// ---------------------------------------------------------------------------
function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Offline</title>
  <style>
    body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,sans-serif;background:#fff;color:#111}
    .c{text-align:center;padding:2rem}
    h1{font-size:1.5rem;margin:0 0 .5rem}
    p{color:#666;margin:0 0 1rem}
    button{padding:.5rem 1.5rem;border-radius:999px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:1rem}
  </style>
</head>
<body>
  <div class="c">
    <h1>You're offline</h1>
    <p>Check your connection and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "New update";
  const options = {
    body: data.body || "A new update is available",
    icon: data.icon || "/web-app-manifest-192x192.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
