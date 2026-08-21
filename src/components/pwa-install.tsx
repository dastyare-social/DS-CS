"use client";

import { useEffect, useRef, useState } from "react";
import "@khmyznikov/pwa-install";
import { DownloadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PwaInstall() {
  const ref = useRef<HTMLDivElement>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const el = ref.current?.querySelector("pwa-install") as any;
    if (!el) return;

    const onInstallAvailable = () => setCanInstall(true);
    const onInstalled = () => setCanInstall(false);

    el.addEventListener("pwa-install-available-event", onInstallAvailable);
    el.addEventListener("pwa-installed-event", onInstalled);

    // Check if already installable on mount
    if (el.isInstallAvailable) setCanInstall(true);

    return () => {
      el.removeEventListener("pwa-install-available-event", onInstallAvailable);
      el.removeEventListener("pwa-installed-event", onInstalled);
    };
  }, []);

  const handleInstall = () => {
    const el = ref.current?.querySelector("pwa-install") as any;
    if (!el) return;
    el.showDialog();
  };

  return (
    <div ref={ref} className="contents">
      <pwa-install
        use-local-storage
        disable-close
      />
      <button
        onClick={handleInstall}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full",
          "bg-primary text-white text-sm font-medium shadow-lg",
          "hover:bg-primary/90 active:scale-95 transition-all",
          "md:hidden", // only show on mobile (desktop gets browser prompt)
        )}
      >
        <DownloadIcon className="size-4" />
        Install App
      </button>
    </div>
  );
}
