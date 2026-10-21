"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import ProductSwitcher from "@/components/product-switcher";
import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_DESKTOP_LEFT_CLASS,
  WORKSPACE_DESKTOP_WIDTH_CLASS,
  WORKSPACE_FEED,
  WORKSPACE_FEED_COOKIE,
  WORKSPACE_LEFT,
  WORKSPACE_LEFT_COOKIE,
  dragLeftBoundary,
  dragRightBoundary,
  fitWorkspaceWidths,
  type WorkspaceWidths,
} from "@/lib/workspace-layout";

const COOKIES = {
  left: WORKSPACE_LEFT_COOKIE,
  feed: WORKSPACE_FEED_COOKIE,
} as const;

const ARIA_LABEL = {
  left: "Resize sidebar",
  feed: "Resize feed column",
  right: "Resize assistant panel",
} as const;

/** How wide a column's edge strip is. The whole strip drags. */
const HANDLE_WIDTH = "w-2.5";

/**
 * Layout effects run before the browser paints, so the stored widths and the
 * published CSS variables are in place on the first frame. With a passive
 * effect the page painted at the fallback width and then jumped to the saved
 * one — the feed visibly resized on every load.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readCookie(name: string): number | null {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${name.replace(/\./g, "\\.")}=([^;]*)`),
    );
    if (!match) return null;
    const value = Number(decodeURIComponent(match[1]!));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function storeCookie(name: string, value: number) {
  try {
    document.cookie = `${name}=${encodeURIComponent(String(value))}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies disabled — resizing still works for this session.
  }
}

function readStoredWidths(viewportWidth: number): WorkspaceWidths {
  const feed = readCookie(COOKIES.feed) ?? WORKSPACE_FEED.default;
  const left =
    readCookie(COOKIES.left) ??
    Math.max(
      WORKSPACE_LEFT.min,
      Math.round((viewportWidth - feed) / 2),
    );

  return fitWorkspaceWidths({ left, feed }, viewportWidth);
}

interface ResizeHandleProps {
  column: "left" | "feed" | "right";
  position: "left" | "right";
  width: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

/**
 * A column's edge strip. The whole strip is the handle — there is no grip in
 * the middle of it — so you can grab the edge anywhere along its height and
 * drag.
 *
 * The strip belongs to the column it sits in. A drag moves the boundary it
 * sits on, and the boundary follows the pointer exactly: the feed trades width
 * with the column next to it, and the feed's other edge does not move. That is
 * why dragging one side of the feed never resizes the other side as well.
 */
function ResizeHandle({
  column,
  position,
  width,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  onDoubleClick,
}: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`${ARIA_LABEL[column]} — ${position} edge`}
      aria-valuemin={WORKSPACE_FEED.min}
      aria-valuemax={WORKSPACE_FEED.max}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      className={cn(
        "group absolute inset-y-0 z-20 touch-none cursor-col-resize outline-none",
        HANDLE_WIDTH,
        position === "left" ? "left-0" : "right-0",
        dragging && "bg-primary/5",
      )}
    >
      {/* The hairline. It is the only affordance: the whole strip above it
          drags, so there is no grip in the middle of the column. */}
      <div
        className={cn(
          "absolute inset-y-0 w-px transition-colors duration-150 motion-reduce:transition-none",
          position === "left" ? "left-0" : "right-0",
          "bg-secondary/20 group-hover:bg-primary/40 group-focus-visible:bg-primary/50",
          dragging && "bg-primary/50",
        )}
      />
    </div>
  );
}

/**
 * Desktop workspace chrome: a left column, the feed, and a right column. The
 * three fill the window edge to edge.
 *
 * The feed is the resizable column. Each of its edges is free: dragging the
 * left edge moves the boundary between the left column and the feed, and
 * dragging the right edge moves the boundary between the feed and the right
 * column. The boundary follows the pointer exactly and only the two columns
 * that meet there trade width, so the feed's other edge stays where it was.
 *
 * The columns are empty by design, so the *edge* is what has to read on
 * screen: a soft surface wash and a hairline divider. A 4% wash was, in
 * practice, invisible.
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
  const [widths, setWidths] = useState<WorkspaceWidths>({
    left: WORKSPACE_LEFT.default,
    feed: WORKSPACE_FEED.default,
  });
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{
    boundary: "left" | "right";
    startX: number;
    latest: WorkspaceWidths;
  } | null>(null);

  // Restore the persisted widths, fitted to the current viewport. This has to
  // run after mount: reading cookies during render would make the first client
  // render disagree with the server HTML and break hydration. It runs as a
  // layout effect so the first paint is already the final width.
  useIsomorphicLayoutEffect(() => {
    setWidths(readStoredWidths(window.innerWidth));
  }, []);

  // Track the breakpoint that decides whether the columns exist.
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${WORKSPACE_BREAKPOINT}px)`);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Re-fit the columns when the window shrinks so nothing overflows.
  useEffect(() => {
    if (!isDesktop) return;

    const onResize = () =>
      setWidths((current) =>
        fitWorkspaceWidths(current, window.innerWidth),
      );

    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [isDesktop]);

  // Publish the feed's width, and where its centre actually is, for the fixed
  // chrome. The shift is measured rather than computed: the columns fill the
  // window, so the feed's centre depends on the layout, not on a formula. A
  // layout effect, so the fixed chrome never paints at the fallback width
  // first.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--workspace-left-width", `${widths.left}px`);
    root.style.setProperty("--workspace-feed-width", `${widths.feed}px`);

    const feed = feedRef.current;
    if (!feed) {
      root.style.setProperty("--workspace-shift", "0px");
      return;
    }

    const publish = () => {
      const rect = feed.getBoundingClientRect();
      root.style.setProperty(
        "--workspace-shift",
        `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      );
    };

    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(feed);
    window.addEventListener("resize", publish);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [widths, isDesktop]);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--workspace-shift", "0px");
      document.documentElement.style.setProperty(
        "--workspace-feed-width",
        "672px",
      );
      document.documentElement.style.setProperty(
        "--workspace-left-width",
        "240px",
      );
    };
  }, []);

  const startResize = useCallback(
    (
      boundary: "left" | "right",
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (event.button !== 0) return;
      event.preventDefault();

      dragRef.current = {
        boundary,
        startX: event.clientX,
        latest: widths,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [widths],
  );

  const moveResize = useCallback(
    (
      boundary: "left" | "right",
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      const drag = dragRef.current;
      if (!drag || drag.boundary !== boundary) return;

      const delta = event.clientX - drag.startX;
      const next =
        boundary === "left"
          ? dragLeftBoundary(drag.latest, delta)
          : dragRightBoundary(drag.latest, delta, window.innerWidth);

      drag.latest = next;
      setWidths(next);
    },
    [],
  );

  const endResize = useCallback(
    (
      boundary: "left" | "right",
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      const drag = dragRef.current;
      if (!drag || drag.boundary !== boundary) return;

      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      storeCookie(COOKIES.left, drag.latest.left);
      storeCookie(COOKIES.feed, drag.latest.feed);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (boundary: "left" | "right", event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0;

      if (step === 0) {
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const next =
            boundary === "left"
              ? dragLeftBoundary(widths, event.key === "Home" ? -10_000 : 10_000)
              : dragRightBoundary(
                  widths,
                  event.key === "Home" ? -10_000 : 10_000,
                  window.innerWidth,
                );
          setWidths(next);
          storeCookie(COOKIES.left, next.left);
          storeCookie(COOKIES.feed, next.feed);
        }
        return;
      }

      event.preventDefault();
      const next =
        boundary === "left"
          ? dragLeftBoundary(widths, step)
          : dragRightBoundary(widths, step, window.innerWidth);
      setWidths(next);
      storeCookie(COOKIES.left, next.left);
      storeCookie(COOKIES.feed, next.feed);
    },
    [widths],
  );

  const resetWidth = useCallback(() => {
    const next = fitWorkspaceWidths(
      {
        left: Math.max(
          WORKSPACE_LEFT.min,
          Math.round((window.innerWidth - WORKSPACE_FEED.default) / 2),
        ),
        feed: WORKSPACE_FEED.default,
      },
      window.innerWidth,
    );
    setWidths(next);
    storeCookie(COOKIES.left, next.left);
    storeCookie(COOKIES.feed, next.feed);
  }, []);

  const handle = (
    boundary: "left" | "right",
    column: "left" | "feed" | "right",
    width: number,
  ) => ({
    width,
    dragging,
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) =>
      startResize(boundary, event),
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) =>
      moveResize(boundary, event),
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) =>
      endResize(boundary, event),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) =>
      handleKeyDown(boundary, event),
    onDoubleClick: resetWidth,
  });

  return (
    <div className="flex w-full items-stretch">
      <aside
        aria-label="Sidebar"
        className={cn(
          "relative hidden min-w-0",
          WORKSPACE_DESKTOP_CLASS,
          WORKSPACE_DESKTOP_LEFT_CLASS,
          "h-dvh flex-col border-r border-secondary/20 bg-secondary/[0.07]",
        )}
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="liquid-glass flex items-center gap-3 rounded-2xl border border-primary/10 px-4 py-3">
            <span className="text-[15px] leading-5 tracking-tighter text-foreground">
              Dastyare Social <span className="text-primary">— CS</span>
            </span>
          </div>

          <ProductSwitcher />
        </div>

        <ResizeHandle
          column="left"
          position="right"
          {...handle("left", "left", widths.left)}
        />
      </aside>

      {/* The feed column. Its width is the shell's business, so the fixed
          chrome inside it can be positioned against it. */}
      <div
        ref={feedRef}
        className={cn(
          "relative w-full shrink-0",
          WORKSPACE_DESKTOP_WIDTH_CLASS,
        )}
      >
        {children}

        <ResizeHandle
          column="feed"
          position="left"
          {...handle("left", "feed", widths.feed)}
        />
        <ResizeHandle
          column="feed"
          position="right"
          {...handle("right", "feed", widths.feed)}
        />
      </div>

      <aside
        aria-label="Assistant panel"
        className={cn(
          "relative hidden min-w-0 flex-1",
          WORKSPACE_DESKTOP_CLASS,
          "h-dvh flex-col border-l border-secondary/20 bg-secondary/[0.07]",
        )}
      >
        <ResizeHandle
          column="right"
          position="left"
          {...handle("right", "right", widths.feed)}
        />
      </aside>
    </div>
  );
}
