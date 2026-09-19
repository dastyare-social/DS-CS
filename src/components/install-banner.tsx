"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/button";
import { XIcon } from "lucide-react";

const DISMISS_KEY = "pwa-install-banner-dismissed";

// In dev mode (docker compose dev run, next dev, bun dev, …) the install
// banner must ALWAYS re-show on every reload — even after the user dismisses
// it. Dismissal is only honored (and persisted) in production builds.
const isDevMode = process.env.NODE_ENV === "development";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallBanner() {
  const t = useTranslations();
  const barRef = useRef<HTMLDivElement>(null);
  // Dev mode (docker compose dev run, next dev, bun dev, …): the banner must
  // ALWAYS show on every reload — even after a dismiss. So in dev we never
  // restore a persisted dismissal and we don't persist one either; dismissal
  // only hides it for the current session. Production keeps the permanent
  // dismiss behavior.
  const [dismissed, setDismissed] = useState(
    () =>
      !isDevMode &&
      typeof window !== "undefined" &&
      window.localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (dismissed) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const hide = () => {
      setDeferredPrompt(null);
    };
    const onDisplayMode = (event: MediaQueryListEvent) => {
      if (event.matches) hide();
    };

    const media = window.matchMedia("(display-mode: standalone)");

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", hide);
    media.addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", hide);
      media.removeEventListener("change", onDisplayMode);
    };
  }, []);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => setIsOnline(true);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Self-report height via CSS variable so pages can offset content,
  // mirroring how the pinned bar offsets the top of the feed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = barRef.current;
    if (!isOnline || !deferredPrompt || !el || dismissed) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--install-banner-height",
        `${el.offsetHeight}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty(
        "--install-banner-height",
        "0px",
      );
    };
  }, [isOnline, deferredPrompt, dismissed]);

  if (typeof window === "undefined" || !isOnline || !deferredPrompt || dismissed)
    return null;

  const dismiss = () => {
    // In dev mode we never persist the dismissal — the banner must keep
    // re-appearing on every reload, even after the user dismissed it.
    if (process.env.NODE_ENV !== "development") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
    setDeferredPrompt(null);
  };

  const install = async () => {
    const prompt = deferredPrompt;
    setDeferredPrompt(null);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  // Full-width bottom bar, fixed just above the footer buttons — between
  // posts and buttons, styled like the bottom buttons rather than a floating card.
  return (
    <div
      ref={barRef}
      className="fixed bottom-[calc(var(--chat-footer-height)-5px)] left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-4 pt-2.5"
    >
      <div className="w-full flex items-center gap-x-2.5 rounded-2xl border border-secondary/5 bg-white/50 backdrop-blur-md px-3 py-2">
        <p className="flex-1 min-w-0 text-[15px] text-secondary/90">
          {t("general.install_app_text")}
        </p>
        <Button
          type="button"
          onClick={install}
          className="shrink-0 text-md md:text-md px-3 py-0.5"
        >
          {t("general.install")}
        </Button>
        <XIcon
          onClick={dismiss}
          className="size-4 stroke-[1.5px] cursor-pointer shrink-0"
        />
      </div>
    </div>
  );
}
