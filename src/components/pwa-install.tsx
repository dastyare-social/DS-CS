"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";

export default function PwaInstallModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const beforeHandler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    const appInstalled = () => {
      setInstalled(true);
      setShow(false);
    };

    window.addEventListener("beforeinstallprompt", beforeHandler as any);
    window.addEventListener("appinstalled", appInstalled as any);
    const openHandler = () => setShow(true);
    window.addEventListener("open-pwa-install", openHandler as any);

    // detect already-installed state (standalone)
    try {
      const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      if ((navigator as any).standalone === true || isStandalone) setInstalled(true);
    } catch {}

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeHandler as any);
      window.removeEventListener("appinstalled", appInstalled as any);
      window.removeEventListener("open-pwa-install", openHandler as any);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // iOS or no prompt available — show instructions
      alert("To install: open the browser menu and choose 'Add to Home screen'.");
      setShow(false);
      return;
    }

    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch (err) {
      // swallow
    } finally {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4">
      <div className="max-w-lg w-full bg-white rounded-lg p-5">
        <h3 className="text-lg font-semibold">Install app</h3>
        <p className="text-sm mt-2">Install this app to your device for a faster, app-like experience.</p>

        <div className="mt-4 flex gap-2 justify-end">
          <Button className="px-3 py-1" onClick={() => setShow(false)}>
            Dismiss
          </Button>
          <Button variant="primary" className="px-3 py-1" onClick={handleInstall}>
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}

export function InstallButton({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const beforeHandler = (e: any) => {
      e.preventDefault();
      setVisible(true);
    };
    const appInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", beforeHandler as any);
    window.addEventListener("appinstalled", appInstalled as any);

    try {
      const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      if ((navigator as any).standalone === true || isStandalone) setInstalled(true);
    } catch {}

    // show button by default on modern browsers when not installed (user requested)
    if (!installed) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeHandler as any);
      window.removeEventListener("appinstalled", appInstalled as any);
    };
  }, [installed]);

  if (installed) return null;

  return (
    <>
      <button
        onClick={() => {
          // open the install modal safely
          const ev = new Event("open-pwa-install");
          window.dispatchEvent(ev);
        }}
        className={className ?? "text-sm md:text-sm px-3.5 py-1.5 backdrop-blur-3xl bg-white/50"}
      >
        Install
      </button>
      <PwaInstallModal />
    </>
  );
}
