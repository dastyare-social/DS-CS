"use client";

import { useEffect } from "react";

const SW_URL = "/sw.js";

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Prefer Serwist's built-in registration when available
  if (window.serwist?.register instanceof Function) {
    try {
      window.serwist.register();
      return;
    } catch (error) {
      console.error("Serwist registration failed, falling back", error);
    }
  }

  // Fallback: register the SW manually
  navigator.serviceWorker.register(SW_URL).catch((error) => {
    console.error("Service worker registration failed", error);
  });
}

export default function RegisterPWA() {
  useEffect(() => {
    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }
  }, []);

  return null;
}
