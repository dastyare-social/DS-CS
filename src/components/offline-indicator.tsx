"use client";

import { useEffect, useState } from "react";
import { WifiOffIcon } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="liquid-glass-dark sticky top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 text-white text-xs font-medium py-1.5 px-3 [--liquid-glass-bg:color-mix(in_srgb,var(--primary)_90%,transparent)]">
      <WifiOffIcon className="size-3.5" />
      You are offline
    </div>
  );
}
