"use client";

import { useEffect, useState } from "react";
import { Button } from "./button";
import { Dialog, DialogContent } from "./dialog";

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

    const openHandler = () => setShow(true);

    window.addEventListener("beforeinstallprompt", beforeHandler as any);
    window.addEventListener("appinstalled", appInstalled as any);
    window.addEventListener("open-pwa-install", openHandler as any);

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
    } catch {
      // ignore install prompt failures
    } finally {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="w-[min(95vw,32rem)] rounded-3xl border border-secondary/5 bg-background/95 p-6 shadow-2xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-lg font-semibold">Install app</div>
            <div className="text-sm text-foreground/80">
              Install this app to your device for a faster, app-like experience and offline access.
            </div>
          </div>

          <div className="flex flex-col justify-center items-start gap-y-2.5 py-6 px-4 w-full border border-secondary/5 rounded-3xl bg-background/50 backdrop-blur-3xl">
            <div className="text-base font-medium">Keep the app handy</div>
            <div className="text-sm text-foreground/70">
              Save the studio on your home screen so you can open it quickly without typing a URL.
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" className="px-4 py-2 text-sm" onClick={() => setShow(false)}>
              Dismiss
            </Button>
            <Button variant="primary" className="px-4 py-2 text-sm" onClick={handleInstall}>
              Install
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="absolute top-4 right-4 rounded-full p-2 text-foreground/70 transition hover:text-foreground"
          onClick={() => setShow(false)}
          aria-label="Close"
        >
          ×
        </button>
      </DialogContent>
    </Dialog>
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

    if (!installed) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeHandler as any);
      window.removeEventListener("appinstalled", appInstalled as any);
    };
  }, [installed]);

  if (installed) return null;
  if (!visible) return null;

  return (
    <>
      <Button
        variant="secondary"
        className={className ?? "text-sm md:text-sm px-3.5 py-1.5"}
        onClick={() => window.dispatchEvent(new Event("open-pwa-install"))}
      >
        Install
      </Button>
      <PwaInstallModal />
    </>
  );
}
