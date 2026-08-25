# PWA Guide — Dastyare Social CS

Complete reference for the PWA implementation: service worker, offline caching, push notifications, install prompt, and all issues encountered and resolved.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Worker](#service-worker)
3. [IndexedDB Offline Storage](#indexeddb-offline-storage)
4. [Manifest and Install Prompt](#manifest-and-install-prompt)
5. [Push Notifications](#push-notifications)
6. [Offline Detection](#offline-detection)
7. [SafeImage — Broken Image Fallback](#safeimage)
8. [Serwist — Disabled](#serwist--disabled)
9. [All Issues and Fixes](#all-issues-and-fixes)

---

## Architecture Overview

```
public/sw.js                   ← Hand-maintained production SW (NOT compiled by Next.js)
src/app/sw.ts                  ← Dead code — never compiled, kept for reference
src/app/manifest.ts            ← Next.js dynamic manifest generation
src/components/register-pwa.tsx ← SW registration client component
next.config.ts                 ← Serwist is DISABLED (no-op passthrough)
```

**Key constraint**: `@serwist/next` is installed but disabled via a no-op passthrough in `next.config.ts` because Vercel webpack builds overwrite `public/sw.js` with a compiled version that breaks the hand-maintained logic. The production SW is always edited directly in `public/sw.js`.

---

## Service Worker

### File: `public/sw.js`

Hand-maintained. Every change must be committed directly.

### Cache Stores

| Cache Name | Purpose | Strategy |
|---|---|---|
| `shell-cache-v1` | Cached HTML shell (`/`) | Preloaded on install |
| `static-cache-v1` | JS, CSS, fonts, `_next/static/` | Cache-first |
| `media-cache-v1` | Images, videos, `_next/image`, animated emojis | Cache-first |
| `trpc-cache-v1` | tRPC API responses | Network-first, fallback to cache |
| `page-cache-v1` | Full page HTML for specific URLs | Network-first |

### IndexedDB

| Database | Store | Key | Purpose |
|---|---|---|---|
| `ds-cs-offline` v1 | `posts` | `id` (keyPath) | Stores all posts for offline access |

### Fetch Handler Interception Rules

All rules are **same-origin only**. Cross-origin requests (PostHog, analytics, etc.) pass through untouched.

1. **Static assets** (`_next/static/`, `.js`, `.css`, `.woff2`) — cache-first
2. **Media** (`_next/image`, `api/media/`, `animated-emojies/`, image/video/audio extensions) — cache-first
3. **tRPC API** (`/api/trpc/`) — network-first. On success: clone response, parse JSON, extract posts, store in IDB + trpc-cache. On failure: serve from trpc-cache or return `{}`
4. **Navigation** (`mode === "navigate"`) — network-first, then cached page, then cached shell (`/`), then offline HTML fallback

### Lifecycle

- **Install**: Caches `"/"` in `shell-cache-v1`, then `skipWaiting()`
- **Activate**: Deletes `-dev` caches, then `clients.claim()`
- **Message**: Responds to `SKIP_WAITING` for immediate activation

---

## IndexedDB Offline Storage

### SW-side extraction

The SW intercepts tRPC responses and stores posts in IndexedDB in the background:

```
tRPC response -> clone -> parse JSON -> extractPostsFromResponse() -> idbPutAll()
```

### tRPC wire format (superjson)

```
[{"result":{"data":{"json":{"items":[...],"page":1,...},"meta":{"values":{...}}}}}]
```

The `extractPostsFromResponse()` function:

1. Unwraps the batch array
2. Unwraps `result.data.json` (superjson envelope)
3. Handles both `{items: [...]}` (posts.list) and plain arrays (posts.pinned)
4. Filters out non-post items (stories with `content === undefined`)
5. Stores `{id, type, content, media, reactions, views, pinnedAt, createdAt, updatedAt, _cachedAt}`

**Note**: The app itself does NOT read from IndexedDB directly. Posts are always fetched via tRPC. The SW stores posts in IDB purely as a background caching layer.

---

## Manifest and Install Prompt

### File: `src/app/manifest.ts`

```ts
icons: [
  {
    src: "/web-app-manifest-192x192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",    // Required for Chrome install prompt
  },
  {
    src: "/web-app-manifest-512x512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
],
display: "standalone",
display_override: ["standalone", "minimal-ui"],
```

### Chrome Install Prompt Requirements

For Chrome to show the omnibox install button (computer with arrow down icon):

1. Valid manifest with `name`, `short_name`, `start_url`, `display: "standalone"`
2. At least one icon 192x192 or larger with `purpose: "maskable"`
3. Service worker registered and activated
4. HTTPS (always true on Vercel)
5. No custom `beforeinstallprompt` handler needed — Chrome handles this natively

### Manifest Icons — What Not To Do

**Problem**: Including `favicon.ico` with `sizes: "any"` causes Chrome error:

> "Error while trying to use the following icon from the Manifest: favicon.ico (Resource size is not correct)"

**Fix**: Remove `favicon.ico` from manifest icons. Only use PNG icons with explicit sizes and `purpose: "maskable"` or `"any"`.

---

## Push Notifications

### SW Handler

```js
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    // Plain text push — show as-is
    const text = event.data ? event.data.text() : "";
    if (text) {
      event.waitUntil(
        self.registration.showNotification("Update", { body: text, ... })
      );
    }
    return;
  }
  // ... show notification with data.title, data.body, data.icon, data.url
});
```

### Push Payload Format

```json
{
  "title": "New Post — Omid Shabab's Channel",
  "body": "Post content preview...",
  "icon": "/web-app-manifest-192x192.png",
  "url": "/"
}
```

Notification titles follow the pattern: `"New Post — Omid Shabab's Channel"` or `"New Story — Omid Shabab's Channel"`.

### Notification Click

Opens `data.url` (defaults to `/`) in a new window via `self.clients.openWindow(url)`.

---

## Offline Detection

### File: `src/components/header.tsx`

```tsx
const [isOffline, setIsOffline] = useState(false);

useEffect(() => {
  let cancelled = false;
  const check = () =>
    fetch("/favicon.ico", { method: "HEAD", cache: "no-store" })
      .then(() => { if (!cancelled) setIsOffline(false); })
      .catch(() => { if (!cancelled) setIsOffline(true); });

  check();
  window.addEventListener("online", check);
  const interval = setInterval(check, 15000);
  return () => {
    cancelled = true;
    window.removeEventListener("online", check);
    clearInterval(interval);
  };
}, []);
```

### Why Not `navigator.onLine`

`navigator.onLine` only checks if the device has a network adapter active (WiFi/LAN connected). It does NOT test actual internet connectivity. A device can be "online" according to the browser but unable to reach any server.

### Why `useState(false)` Not `true`

Must start as `false` (online) to match the server-side render. Starting as `true` causes React hydration mismatch (error #418) because the server always renders "offline" text but the cached HTML shell was rendered with "online" state. The `useEffect` quickly corrects the state on mount.

### Connectivity Check Details

- `fetch("/favicon.ico", { method: "HEAD", cache: "no-store" })` — bypasses SW cache, tests real network
- Runs on mount, on `online` event, and every 15 seconds

---

## SafeImage

### File: `src/components/safe-image.tsx`

Wraps `next/image` with an `onError` fallback. When an image fails to load, shows a `Loader2Icon` spinner instead of the browser's broken image icon.

- All images use `alt=""` (no alt text)
- Detects `fill` prop to position fallback correctly (`absolute inset-0 m-auto`)
- No background color on fallback
- Used in: `stories.tsx`, `post.tsx`, `thread.tsx`, `image-slider.tsx`

### Profile Image Preloading

Root layout (`src/app/(routes)/layout.tsx`) includes:

```html
<link rel="preload" href="/profile-image.png" as="image" />
```

Browser downloads once on first page load. All `<SafeImage>` instances reuse the cached response. The SW also caches `/_next/image` URLs for the profile image via the media cache handler.

---

## Serwist — Disabled

### File: `next.config.ts`

```ts
const withSerwist = (_config: NextConfig) => _config;  // No-op passthrough
```

`@serwist/next` is installed but completely disabled. Reason: Vercel's webpack build uses `@serwist/webpack-plugin` which overwrites `public/sw.js` with a compiled Workbox version. This breaks the hand-maintained SW logic (IndexedDB extraction, tRPC parsing, same-origin guard, etc.).

### `src/app/sw.ts` — Dead Code

This file imports from `@serwist/next/worker` and creates a `Serwist` instance. It is never compiled — Next.js does not pick it up because Serwist is disabled in the config. Kept for reference only.

---

## All Issues and Fixes

### 1. Service Worker Never Registered

**Symptom**: PWA not working, no SW in DevTools, no offline support.

**Root cause**: `RegisterPWA` component was defined in `src/components/register-pwa.tsx` but never imported in any layout file. The SW registration code existed but never ran.

**Fix**: Added `<RegisterPWA />` to `src/app/(routes)/layout.tsx` (root layout).

**Commit**: `560845c`

---

### 2. Serwist Overwrites Production SW

**Symptom**: After deploying, `public/sw.js` was replaced by a compiled Workbox version that did not parse tRPC responses or store posts in IndexedDB.

**Root cause**: `@serwist/next` with `withSerwist()` in `next.config.ts` triggers a webpack plugin that rewrites `public/sw.js` during build.

**Fix**: Disabled Serwist with a no-op passthrough:

```ts
const withSerwist = (_config: NextConfig) => _config;
```

**Commit**: `96aa5eb`

---

### 3. tRPC Response Not Parsed (superjson)

**Symptom**: Posts not stored in IndexedDB. SW logged nothing.

**Root cause**: tRPC uses `httpBatchLink` + `superjson`, so responses are wrapped in a `{json, meta}` envelope inside the standard tRPC batch format. The original parser expected raw `{items: [...]}` format.

**Fix**: Updated `extractPostsFromResponse()` to unwrap `result.data.json` (superjson envelope) and handle both array and `{items: [...]}` formats.

**Commit**: `96aa5eb`

---

### 4. PostHog CSP Violations

**Symptom**: Console errors like:

> "Connecting to 'https://us-assets.i.posthog.com/...' violates the following Content Security Policy directive: 'default-src 'self''"

**Root cause**: The SW was intercepting cross-origin `.js` requests (PostHog analytics) and failing because the page's CSP only allows `'self'`.

**Fix**: Added `sameOrigin` check at the top of the fetch handler:

```js
const sameOrigin = url.origin === self.location.origin;
```

All cache handlers now only intercept same-origin requests. Cross-origin requests pass through untouched.

**Commit**: `deab971`

---

### 5. "Response body is already used" Error

**Symptom**: Console error when tRPC requests came in rapid succession.

**Root cause**: The tRPC handler cloned the response, consumed one clone for JSON parsing, then tried to use the same clone for cache storage. You can only consume a cloned body once.

**Fix**: Clone both copies upfront before consuming either:

```js
const cloneForJson = response.clone();
const cloneForCache = response.clone();
```

**Commit**: `deab971`

---

### 6. Push Notification JSON Parse Crash

**Symptom**: `Uncaught SyntaxError: Failed to execute 'json' on 'PushMessageData': Unexpected token 'T', "Test push"... is not valid JSON`

**Root cause**: `event.data?.json()` was called unconditionally. When the push payload is plain text (e.g., "Test push"), `.json()` throws.

**Fix**: Wrapped in try/catch. Falls back to `.text()` for plain text payloads:

```js
try {
  data = event.data ? event.data.json() : {};
} catch (_) {
  const text = event.data ? event.data.text() : "";
  if (text) {
    event.waitUntil(
      self.registration.showNotification("Update", { body: text, ... })
    );
  }
  return;
}
```

**Commit**: `024effb`

---

### 7. Manifest favicon.ico Icon Error

**Symptom**: `Error while trying to use the following icon from the Manifest: favicon.ico (Resource size is not correct)`

**Root cause**: `favicon.ico` with `sizes: "any"` is not a valid icon for Chrome's PWA installability check. Chrome requires explicit PNG icons with proper dimensions.

**Fix**: Removed `favicon.ico` from manifest icons. Added `purpose: "maskable"` to the 192x192 PNG icon (required for Chrome install prompt).

**Commit**: `024effb`

---

### 8. React Hydration Error #418

**Symptom**: `Uncaught Error: Minified React error #418` — entire page crashes, posts do not load.

**Root cause**: Header component used `useState(true)` for `isOffline`. The server renders with `true` (showing "offline" text), but the cached HTML shell from `shell-cache-v1` was rendered with the old code where `isOffline` was `false` (showing post count). When React hydrates the cached HTML with the new code, the mismatch causes error #418.

**Fix**: Reverted to `useState(false)`. The `useEffect` fetch-based connectivity check quickly corrects the state on mount. The initial render matches the server and the cached shell.

**Commit**: `1c07991`

---

### 9. Profile Image Not Available Offline

**Symptom**: Profile image (circular avatar) shows broken image icon when offline.

**Root cause**: `next/image` generates `/_next/image?url=/profile-image.png&w=...` URLs. These URLs did not match any SW cache handler — they fell through to the browser's default behavior and were never cached.

**Fix**: Added `/_next/image` prefix to the media cache handler (cache-first, same-origin only):

```js
url.pathname.startsWith("/_next/image")
```

Also added `<link rel="preload" href="/profile-image.png" as="image" />` to the root layout so the browser caches it on first visit.

**Commits**: `024effb`, `04bf139`

---

### 10. Offline Detection Unreliable (navigator.onLine)

**Symptom**: When offline, header showed "X posts published" instead of "Trying to connect...". `navigator.onLine` returned `true` even without internet.

**Root cause**: `navigator.onLine` only checks if a network adapter is active (WiFi connected), not if the device can actually reach servers.

**Fix**: Replaced `navigator.onLine` + event listeners with a fetch-based connectivity check:

```js
fetch("/favicon.ico", { method: "HEAD", cache: "no-store" })
```

The `cache: "no-store"` bypasses the SW cache, ensuring a real network test. Rechecks every 15 seconds and on `online` events.

**Commit**: `024effb`

---

### 11. SW Registration Failure After Install Handler Change

**Symptom**: `Service worker registration failed: An unknown error occurred when fetching the script` — SW could not register at all. Offline page showed bare "You're offline" HTML instead of the cached app.

**Root cause**: Changed the SW install handler to precache multiple URLs including `/_next/image?url=...`. The Next.js image optimization endpoint (`/_next/image`) requires server-side processing and may return redirects or errors during SW install. This caused the install handler to hang or timeout, preventing the SW from activating.

**Fix**: Reverted the install handler to the original simple version — only caches `"/"` during install. The `/_next/image` media caching is handled at runtime by the fetch handler, not during install.

**Commit**: `6c6e997`

---

### 12. Broken Images Show Ugly Browser Default

**Symptom**: When post images or profile images fail to load (network error, deleted resource), the browser shows its default broken image icon — a small torn-page graphic that looks unprofessional.

**Root cause**: No error handling on `<Image>` components. When `onerror` fires, the browser renders its default placeholder.

**Fix**: Created `SafeImage` component (`src/components/safe-image.tsx`) that wraps `next/image` with an `onError` handler. On error, replaces the image with a `Loader2Icon` spinner (same one used in the app's loading states). Detects `fill` prop for correct positioning. No background color. All image usages across the app replaced with `SafeImage`. All `alt` attributes set to `""`.

**Commit**: `04bf139`, `4f90a15`

---

### 13. Dev Bypass Broke Push (Firefox: "Error retrieving push subscription")

**Symptom**: Enabling notifications on localhost fails with `DOMException: Error retrieving push subscription`. Safari/Chrome subscribe fine; only Firefox throws.

**Root cause**: The dev bypass added to `register-pwa.tsx` (stale UI fix) unregistered the service worker and returned early on every page load. When the notifications modal then registered the SW on demand during the "Enable" click, Firefox rejected `pushManager.subscribe()` against the seconds-old registration — its push actor is not ready yet. This silently reverted half of the original push fix (`bcf3365`: SW always active from page load).

**Fix**: Keep the dev cache purge (that is what actually fixes stale bundles — caches, not SW existence), but always register `/sw.js`, dev included. Never unregister on page load.

```tsx
if (isDev()) {
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}
navigator.serviceWorker.register(SW_URL);
```

**Recovery for affected browsers**: after deploying, unregister the site's service worker once (DevTools → Application → Service Workers → Unregister) and reload, then enable notifications again.
