"use client";

import { useEffect } from "react";

const SW_URL = "/sw.js";

function isDev() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Dev: purge caches so stale bundles never survive a restart. The SW itself
  // still registers — push subscribe() fails in Firefox when no SW was active
  // before the click (see docs/pwa-guide.md, issue 13).
  if (isDev()) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (_) {}
  }

  navigator.serviceWorker.register(SW_URL).catch((error) => {
    console.error("Service worker registration failed", error);
  });
}

export default function RegisterPWA() {
  useEffect(() => {
    if (document.readyState === "complete") {
      void registerServiceWorker();
    } else {
      window.addEventListener("load", () => void registerServiceWorker(), {
        once: true,
      });
    }
  }, []);

  return null;
}
