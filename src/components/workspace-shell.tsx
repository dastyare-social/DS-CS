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
  WORKSPACE_WIDTH_COOKIE,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_DESKTOP_WIDTH_CLASS,
  WORKSPACE_FEED,
  fitFeedWidth,
  type WorkspaceColumn,
} from "@/lib/workspace-layout";

const ARIA_LABEL = {
  sidebar: "Resize sidebar",
  feed: "Resize feed column",
  panel: "Resize assistant panel",
} as const;

/** How wide a column's edge strip is. The whole strip drags. */
const HANDLE_WIDTH = "w-2.5";

/**
 * Layout effects run before the browser paints, so the stored width and the
 * published CSS variable are in place on the first frame. With a passive
 * effect the page painted at the fallback width and then jumped to the saved
 * one — the feed visibly resized on every load.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function readStoredWidth(): number {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${WORKSPACE_WIDTH_COOKIE.replace(/\./g, "\\.")}=([^;]*)`),
    );
    const value = match ? Number(decodeURIComponent(match[1]!)) : Number.NaN;
    return Number.isFinite(value) ? value : WORKSPACE_FEED.default;
  } catch {
    return WORKSPACE_FEED.default;
  }
}

function storeWidth(value: number) {
  try {
    document.cookie = `${WORKSPACE_WIDTH_COOKIE}=${encodeURIComponent(String(value))}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookies disabled — resizing still works for this session.
  }
}

interface ResizeHandleProps {
  column: WorkspaceColumn;
  /** Where the strip sits inside its own column. */
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
 * The strip belongs to the column whose edge it sits on, and it moves that
 * edge. Dragging the feed's left edge widens the column to its left; dragging
 * its right edge widens the column to its right. The window edges have
 * nothing to grab: the right panel is against the edge of the window, so it
 * is resized from its left edge like every other column.
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
 * Desktop workspace chrome: the feed in the middle, a sidebar to its left and
 * an assistant panel to its right. The feed is the resizable column — the
 * side columns are what is left of the window, so they are always against the
 * window edges.
 *
 * The row is the full width of the window. The columns are empty by design,
 * so the *edge* is what has to read on screen: a soft surface wash and a
 * hairline divider. A 4% wash was, in practice, invisible.
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
  const [feedWidth, setFeedWidth] = useState<number>(
    WORKSPACE_FEED.default,
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{
    edge: "left" | "right";
    startX: number;
    startWidth: number;
    latestWidth: number;
  } | null>(null);

  // Restore the persisted width, fitted to the current viewport. This has to
  // run after mount: reading localStorage during render would make the first
  // client render disagree with the server HTML and break hydration. It runs
  // as a layout effect so the first paint is already the final width — with a
  // passive effect the page painted at the fallback width and then jumped to
  // the saved one.
  useIsomorphicLayoutEffect(() => {
    setFeedWidth(fitFeedWidth(readStoredWidth(), window.innerWidth));
  }, []);

  // Track the breakpoint that decides whether the columns exist.
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${WORKSPACE_BREAKPOINT}px)`);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Re-fit the feed when the window shrinks so the columns never collapse.
  useEffect(() => {
    if (!isDesktop) return;

    const onResize = () =>
      setFeedWidth((current) => fitFeedWidth(current, window.innerWidth));

    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [isDesktop]);

  // Publish the feed's width, and where its centre actually is, for the fixed
  // chrome. The shift is measured rather than computed: the columns sit
  // against the window edges, so the feed's centre depends on the layout, not
  // on a formula. A layout effect, so the fixed chrome never paints at the
  // fallback width first.
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--workspace-feed-width", `${feedWidth}px`);

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
  }, [feedWidth, isDesktop]);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--workspace-shift", "0px");
      document.documentElement.style.setProperty(
        "--workspace-feed-width",
        "672px",
      );
    };
  }, []);

  const startResize = useCallback(
    (
      feedEdge: "left" | "right",
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      if (event.button !== 0) return;
      event.preventDefault();

      dragRef.current = {
        edge: feedEdge,
        startX: event.clientX,
        startWidth: feedWidth,
        latestWidth: feedWidth,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    },
    [feedWidth],
  );

  const moveResize = useCallback(
    (
      feedEdge: "left" | "right",
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      const drag = dragRef.current;
      if (!drag || drag.edge !== feedEdge) return;

      // A left edge dragged leftwards makes the feed wider; a right edge
      // dragged rightwards does the same. Both grow the feed.
      const delta =
        (event.clientX - drag.startX) * (feedEdge === "left" ? -1 : 1);
      const next = fitFeedWidth(drag.startWidth + delta, window.innerWidth);

      drag.latestWidth = next;
      setFeedWidth(next);
    },
    [],
  );

  const endResize = useCallback(
    (
      feedEdge: "left" | "right",
      event: React.PointerEvent<HTMLDivElement>,
    ) => {
      const drag = dragRef.current;
      if (!drag || drag.edge !== feedEdge) return;

      dragRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      storeWidth(drag.latestWidth);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;

      switch (event.key) {
        case "ArrowLeft":
          next = feedWidth - 16;
          break;
        case "ArrowRight":
          next = feedWidth + 16;
          break;
        case "Home":
          next = WORKSPACE_FEED.min;
          break;
        case "End":
          next = WORKSPACE_FEED.max;
          break;
        default:
          return;
      }

      event.preventDefault();
      const fitted = fitFeedWidth(next, window.innerWidth);
      setFeedWidth(fitted);
      storeWidth(fitted);
    },
    [feedWidth],
  );

  const resetWidth = useCallback(() => {
    const fitted = fitFeedWidth(WORKSPACE_FEED.default, window.innerWidth);
    setFeedWidth(fitted);
    storeWidth(fitted);
  }, []);

  return (
    <div className="flex w-full items-stretch">
      <aside
        aria-label="Sidebar"
        className={cn(
          "relative hidden min-w-0 flex-1",
          WORKSPACE_DESKTOP_CLASS,
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
          column="sidebar"
          position="right"
          width={feedWidth}
          dragging={dragging}
          onPointerDown={(event) => startResize("left", event)}
          onPointerMove={(event) => moveResize("left", event)}
          onPointerUp={(event) => endResize("left", event)}
          onKeyDown={handleKeyDown}
          onDoubleClick={resetWidth}
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
          width={feedWidth}
          dragging={dragging}
          onPointerDown={(event) => startResize("left", event)}
          onPointerMove={(event) => moveResize("left", event)}
          onPointerUp={(event) => endResize("left", event)}
          onKeyDown={handleKeyDown}
          onDoubleClick={resetWidth}
        />
        <ResizeHandle
          column="feed"
          position="right"
          width={feedWidth}
          dragging={dragging}
          onPointerDown={(event) => startResize("right", event)}
          onPointerMove={(event) => moveResize("right", event)}
          onPointerUp={(event) => endResize("right", event)}
          onKeyDown={handleKeyDown}
          onDoubleClick={resetWidth}
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
          column="panel"
          position="left"
          width={feedWidth}
          dragging={dragging}
          onPointerDown={(event) => startResize("right", event)}
          onPointerMove={(event) => moveResize("right", event)}
          onPointerUp={(event) => endResize("right", event)}
          onKeyDown={handleKeyDown}
          onDoubleClick={resetWidth}
        />
      </aside>
    </div>
  );
}
