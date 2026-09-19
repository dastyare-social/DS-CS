"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/button";
import { XIcon } from "lucide-react";

const DISMISS_KEY = "app-update-banner-dismissed";

// GitHub repo that publishes releases with the changelog for each version.
// On a git tag vX.Y.Z the docker image is tagged X.Y.Z (see
// .github/workflows/docker-publish.yml), so the release page for a newer
// version is https://github.com/<repo>/releases/tag/v<version>.
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || "dastyare-social/DS-CS";

// In dev mode (docker compose dev run, next dev, bun dev, …) the update
// banner must ALWAYS re-show on every reload — even after the user dismisses
// it. Dismissal is only honored (and persisted) in production builds.
const isDevMode = process.env.NODE_ENV === "development";

interface UpdateCheckResponse {
  updateAvailable: boolean;
  latest: string | null;
  current: string | null;
}

export default function UpdateBanner() {
  const t = useTranslations();
  const barRef = useRef<HTMLDivElement>(null);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(
    () =>
      !isDevMode &&
      typeof window !== "undefined" &&
      window.localStorage.getItem(DISMISS_KEY) === "1",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (dismissed) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/update-check");
        if (!res.ok) return;
        const data: UpdateCheckResponse = await res.json();
        if (cancelled) return;
        if (data.updateAvailable) {
          setNewVersion(data.latest);
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or API error — keep the banner hidden until the next poll.
      }
    };

    check();
    const id = setInterval(check, 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dismissed]);

  // Self-report height via CSS variable so pages can offset content,
  // mirroring how the install banner offsets the chat footer.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = barRef.current;
    if (!updateAvailable || !el || dismissed) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--update-banner-height",
        `${el.offsetHeight}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--update-banner-height", "0px");
    };
  }, [updateAvailable, dismissed]);

  const dismiss = () => {
    // Dev mode never persists the dismissal — the banner keeps re-appearing
    // on every reload, mirroring the install banner's dev behaviour.
    if (!isDevMode) {
      window.localStorage.setItem(DISMISS_KEY, "1");
      setDismissed(true);
    }
  };

  if (typeof window === "undefined" || !updateAvailable || dismissed) return null;

  const releaseUrl = newVersion
    ? `https://github.com/${GITHUB_REPO}/releases/tag/v${newVersion}`
    : `https://github.com/${GITHUB_REPO}/releases`;

  return (
    <div
      ref={barRef}
      className="fixed bottom-[calc(var(--chat-footer-height)-5px)] left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-4 pt-2.5"
    >
      <div className="w-full flex items-center gap-x-2.5 rounded-2xl border border-secondary/5 bg-white/50 backdrop-blur-md px-3 py-2">
        <p className="flex-1 min-w-0 text-[15px] text-secondary/90">
          {t("general.update_app_text")}
        </p>
        <Button
          asChild
          className="shrink-0 text-md md:text-md px-3 py-0.5"
        >
          <a href={releaseUrl} target="_blank" rel="noopener noreferrer">
            {t("general.update")}
          </a>
        </Button>
        <XIcon
          onClick={dismiss}
          className="size-4 stroke-[1.5px] cursor-pointer shrink-0"
        />
      </div>
    </div>
  );
}
