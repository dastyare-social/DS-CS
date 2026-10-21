"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/resizable";
import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_FEED,
  WORKSPACE_LEFT,
  WORKSPACE_PANEL_IDS,
  WORKSPACE_RIGHT,
  WORKSPACE_WIDTHS_COOKIE,
  layoutFromWidths,
  widthsFromLayout,
  type WorkspaceLayout,
} from "@/lib/workspace-layout";

/**
 * Layout effects run before the browser paints, so the measured width and the
 * published CSS variables are in place on the first frame.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${name.replace(/\./g, "\\.")}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]!) : null;
  } catch {
    return null;
  }
}

function storeCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies disabled — resizing still works for this session.
  }
}

function readStoredLayout(): WorkspaceLayout | undefined {
  const raw = readCookie(WORKSPACE_WIDTHS_COOKIE);
  if (!raw) return undefined;

  try {
    const widths = JSON.parse(raw) as { left?: number; feed?: number };
    if (!Number.isFinite(widths.left) || !Number.isFinite(widths.feed)) {
      return undefined;
    }
    return layoutFromWidths(
      { left: widths.left!, feed: widths.feed! },
      window.innerWidth,
    );
  } catch {
    return undefined;
  }
}

/**
 * Desktop workspace chrome: a left column, the feed, and a right column, all
 * resizable with the shadcn `Resizable` component.
 *
 * The three columns fill the window edge to edge. The feed is the one that
 * carries the content; the right column takes what is left of the window.
 *
 * The fixed chrome inside the feed (the header, the pinned bar, the footers)
 * is positioned against the viewport, so it has to be told where the feed
 * actually is: `--workspace-feed-width` is the feed's width and
 * `--workspace-shift` is how far its centre sits from the viewport's centre.
 * Fixed chrome must use both, or it drifts off the feed.
 *
 * From `WORKSPACE_BREAKPOINT` (1024px) the columns exist. Below it the feed is
 * full width and the layout is the existing mobile-first single column.
 */
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // The saved layout is read once, before the first render. The inline script
  // in the layout has already put the same sizes in the DOM, so the columns
  // are where they belong on the first paint and there is nothing to jump.
  const [savedLayout] = useState<WorkspaceLayout | undefined>(() =>
    readStoredLayout(),
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Track the breakpoint that decides whether the columns exist.
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${WORKSPACE_BREAKPOINT}px)`);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Publish the feed's width, and where its centre actually is, for the fixed
  // chrome. The shift is measured rather than computed: the columns fill the
  // window, so the feed's centre depends on the layout, not on a formula.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    const feed = feedRef.current;

    const publish = () => {
      if (!feed) return;
      const rect = feed.getBoundingClientRect();
      root.style.setProperty(
        "--workspace-feed-width",
        `${Math.round(rect.width)}px`,
      );
      root.style.setProperty(
        "--workspace-shift",
        `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      );
    };

    publish();

    if (!feed) return;

    const observer = new ResizeObserver(publish);
    observer.observe(feed);
    window.addEventListener("resize", publish);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [savedLayout, isDesktop]);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--workspace-shift", "0px");
      document.documentElement.style.setProperty(
        "--workspace-feed-width",
        "672px",
      );
    };
  }, []);

  const handleLayoutChange = useCallback((next: WorkspaceLayout) => {
    const widths = widthsFromLayout(next, window.innerWidth);
    storeCookie(
      WORKSPACE_WIDTHS_COOKIE,
      JSON.stringify({ left: widths.left, feed: widths.feed }),
    );
  }, []);

  const defaultLayout =
    savedLayout ??
    layoutFromWidths(
      {
        left: WORKSPACE_LEFT.default,
        feed: WORKSPACE_FEED.default,
      },
      typeof window === "undefined" ? 1440 : window.innerWidth,
    );

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="flex w-full items-stretch"
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChange}
    >
      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.left}
        minSize={WORKSPACE_LEFT.min}
        maxSize={WORKSPACE_LEFT.max}
        className={cn(
          "relative hidden min-w-0",
          WORKSPACE_DESKTOP_CLASS,
          "h-dvh flex-col",
        )}
      />

      <ResizableHandle className="hidden xl:flex" />

      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.feed}
        minSize={WORKSPACE_FEED.min}
        maxSize={WORKSPACE_FEED.max}
        className="relative min-w-0"
      >
        <div ref={feedRef} className="relative w-full">
          {children}
        </div>
      </ResizablePanel>

      <ResizableHandle className="hidden xl:flex" />

      <ResizablePanel
        id={WORKSPACE_PANEL_IDS.right}
        minSize={WORKSPACE_RIGHT.min}
        maxSize={WORKSPACE_RIGHT.max}
        className={cn(
          "relative hidden min-w-0",
          WORKSPACE_DESKTOP_CLASS,
          "h-dvh flex-col",
        )}
      />
    </ResizablePanelGroup>
  );
}
