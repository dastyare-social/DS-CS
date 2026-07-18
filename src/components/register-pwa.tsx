"use client";

import { useEffect } from "react";

export default function RegisterPWA() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.serwist?.register instanceof Function
    ) {
      window.serwist.register();
    }
  }, []);

  return null;
}
