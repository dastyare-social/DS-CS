import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig, RuntimeCaching } from "serwist";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate, CacheableResponsePlugin } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }

  interface WorkerGlobalScopeEventMap {
    push: PushEvent;
    notificationclick: NotificationEvent;
  }
}

declare const self: WorkerGlobalScope & { registration: ServiceWorkerRegistration; clients: Clients };

const cacheable = new CacheableResponsePlugin({ statuses: [0, 200] });

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: /\/api\/trpc\/.*/i,
    handler: new NetworkFirst({
      cacheName: "trpc-cache",
      networkTimeoutSeconds: 5,
      plugins: [cacheable],
    }),
  },
  {
    matcher: /\/_next\/static\/.*/i,
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [cacheable],
    }),
  },
  {
    matcher: /\.(?:png|gif|jpg|jpeg|webp|svg|ico)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: "images",
      plugins: [cacheable],
    }),
  },
  {
    matcher: /\.(?:woff|woff2|ttf|eot)$/i,
    handler: new CacheFirst({
      cacheName: "fonts",
      plugins: [cacheable],
    }),
  },
  {
    matcher: /\/animated-emojies\/.*/i,
    handler: new StaleWhileRevalidate({
      cacheName: "animated-emojis",
      plugins: [cacheable],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();

self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() || {};
  const title = data.title || "New update";
  const options = {
    body: data.body || "A new update is available",
    icon: data.icon || "/profile-image.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
