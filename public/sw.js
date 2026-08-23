// Service worker — push notifications + offline caching via Cache API + IndexedDB.

// ---------------------------------------------------------------------------
// Cache names
// ---------------------------------------------------------------------------
const TRPC_CACHE = "trpc-cache-v1";
const STATIC_CACHE = "static-cache-v1";
const PAGE_CACHE = "page-cache-v1";
const MEDIA_CACHE = "media-cache-v1";
const SHELL_CACHE = "shell-cache-v1";

// Dev bypass flag — the SW stays fully out of the way on localhost
const IS_DEV = self.location.hostname === "localhost";

// ---------------------------------------------------------------------------
// IndexedDB helpers
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

function idbPutAll(posts) {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readwrite");
        const store = tx.objectStore(POSTS_STORE);
        for (const post of posts) store.put(post);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      }),
  );
}

function idbCount() {
  return idbOpen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(POSTS_STORE, "readonly");
        const req = tx.objectStore(POSTS_STORE).count();
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => { db.close(); reject(req.error); };
      }),
  );
}

// ---------------------------------------------------------------------------
// Extract posts from tRPC response and store in IndexedDB
//
// tRPC httpBatchLink + superjson wire format:
//   [{"result":{"data":{"json":{"items":[...]},"meta":{}}}}]
// ---------------------------------------------------------------------------
function extractPostsFromResponse(data) {
  if (!data || typeof data !== "object") return [];

  const entries = Array.isArray(data) ? data : [data];
  const allPosts = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;

    const resultData = entry?.result?.data;
    if (!resultData || typeof resultData !== "object") continue;

    // superjson wraps in {json, meta} — unwrap if present
    const unwrapped =
      resultData.json !== undefined ? resultData.json : resultData;

    // Could be {items: [...]} (posts.list) or a plain array (posts.pinned)
    let items;
    if (Array.isArray(unwrapped)) {
      items = unwrapped;
    } else if (unwrapped && Array.isArray(unwrapped.items)) {
      items = unwrapped.items;
    } else {
      continue;
    }

    for (const p of items) {
      if (p && p.id && p.content !== undefined) {
        allPosts.push({
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
        });
      }
    }
  }

  return allPosts;
}

// ---------------------------------------------------------------------------
// Offline fallback HTML
// ---------------------------------------------------------------------------
function offlineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <title>Dastyare Social — CS</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#111}
    .c{text-align:center;padding:2rem;max-width:360px}
    h1{font-size:1.25rem;margin-bottom:.5rem;font-weight:600}
    p{color:#666;font-size:.875rem;margin-bottom:1.25rem;line-height:1.5}
    .dots{display:inline-flex;gap:2px;vertical-align:middle;margin-left:4px}
    .dots span{width:4px;height:4px;border-radius:50%;background:#ca8a04;display:inline-block;animation:blink 1.4s infinite both}
    .dots span:nth-child(2){animation-delay:.2s}
    .dots span:nth-child(3){animation-delay:.4s}
    @keyframes blink{0%,20%{opacity:.2}40%,100%{opacity:1}}
    button{padding:.5rem 1.25rem;border-radius:999px;border:1px solid #e5e7eb;background:#fff;cursor:pointer;font-size:.875rem;font-weight:500;transition:background .15s}
    button:hover{background:#f9fafb}
  </style>
</head>
<body>
  <div class="c">
    <h1>You're offline</h1>
    <p>Waiting for connection<span class="dots"><span></span><span></span><span></span></span></p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Lifecycle — fast install, immediate activation
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!IS_DEV) {
        try {
          const cache = await caches.open(SHELL_CACHE);
          try {
            const response = await fetch("/");
            if (response.ok) await cache.put("/", response);
          } catch (_) {}
        } catch (_) {}
      }
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      if (IS_DEV) {
        // Dev: purge every cache so stale bundles never survive a restart
        await Promise.all(keys.map((k) => caches.delete(k)));
      } else {
        await Promise.all(keys.filter((k) => k.endsWith("-dev")).map((k) => caches.delete(k)));
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Fetch handler
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET") return;

  // Dev bypass: never intercept on localhost — always fresh code from the dev server
  if (IS_DEV) return;

  // Only intercept same-origin requests — never touch cross-origin (PostHog etc.)
  const sameOrigin = url.origin === self.location.origin;

  // Static assets: cache-first (same-origin only)
  if (
    sameOrigin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".woff2"))
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
      }),
    );
    return;
  }

  // Media files + Next.js optimized images: cache-first (same-origin only)
  // Covers /_next/image (next/image optimization), animated emojis, and static media files
  if (
    sameOrigin &&
    (url.pathname.startsWith("/_next/image") ||
      url.pathname.startsWith("/animated-emojies/") ||
      /\.(png|jpe?g|webp|gif|svg|mp4|webm|mp3|ogg|wav|ico)$/i.test(url.pathname))
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
      }),
    );
    return;
  }

  // tRPC API: network-first, store posts in IDB + raw response in Cache API
  if (sameOrigin && url.pathname.startsWith("/api/trpc/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone both copies upfront — can't clone after body is consumed
          const cloneForJson = response.clone();
          const cloneForCache = response.clone();

          // Parse tRPC response and store posts in IDB (background)
          cloneForJson.json()
            .then((data) => {
              const posts = extractPostsFromResponse(data);
              if (posts.length) {
                idbPutAll(posts)
                  .then(() => idbCount())
                  .then((count) => {
                    console.log(`[SW] IDB stored ${posts.length} posts, total: ${count}`);
                  })
                  .catch((err) => {
                    console.error("[SW] IDB store failed:", err);
                  });
              }
            })
            .catch(() => {});

          // Cache raw response for offline tRPC fallback
          caches.open(TRPC_CACHE).then((cache) => {
            cache.put(event.request, cloneForCache);
          });

          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) =>
              cached ||
              new Response("{}", {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }),
          ),
        ),
    );
    return;
  }

  // Navigation: network-first → cache → offline shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          const clone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(event.request, clone));
          if (response.ok) {
            const shellClone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put("/", shellClone));
          }
          return response;
        } catch (_) {}

        const cached = await caches.match(event.request);
        if (cached) return cached;

        const home = await caches.match("/", { ignoreSearch: true });
        if (home) return home;

        return new Response(offlineHTML(), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      })(),
    );
    return;
  }
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    // Plain text push (e.g. "Test push") — show as-is
    const text = event.data ? event.data.text() : "";
    if (text) {
      event.waitUntil(
        self.registration.showNotification("Update", { body: text, icon: "/web-app-manifest-192x192.png", data: { url: "/" } })
      );
    }
    return;
  }
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
