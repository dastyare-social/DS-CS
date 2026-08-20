"use client";

import { useEffect, useRef } from "react";
import "@khmyznikov/pwa-install";

export default function PwaInstall() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector("pwa-install") as any;
    if (!el) return;

    const onInstallSuccess = () => {
      el.hideDialog?.();
    };

    el.addEventListener("pwa-install-success-event", onInstallSuccess);
    return () => {
      el.removeEventListener("pwa-install-success-event", onInstallSuccess);
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      <pwa-install
        manual-apple="true"
        use-local-storage="true"
        disable-close="true"
      />
    </div>
  );
}
