"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_DESKTOP_WIDTH_CLASS,
  WORKSPACE_DEFAULT_WIDTHS,
  WORKSPACE_RANGES,
  fitWorkspaceWidths,
  workspaceShift,
  type WorkspaceColumn,
  type WorkspaceWidths,
} from "@/lib/workspace-layout";

const STORAGE_KEYS = {
  sidebar: "ds.workspace.sidebar-width",
  feed: "ds.workspace.feed-width",
  panel: "ds.workspace.panel-width",
} as const;

const ARIA_LABEL = {
  sidebar: "Resize sidebar",
  feed: "Resize feed column",
  panel: "Resize assistant panel",
} as const;

function readStoredWidths(): WorkspaceWidths {
  const read = (key: string, fallback: number) => {
    try {
      const raw = window.localStorage.getItem(key);
      const value = raw === null ? Number.NaN : Number(raw);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    sidebar: read(STORAGE_KEYS.sidebar, WORKSPACE_DEFAULT_WIDTHS.sidebar),
    feed: read(STORAGE_KEYS.feed, WORKSPACE_DEFAULT_WIDTHS.feed),
    panel: read(STORAGE_KEYS.panel, WORKSPACE_DEFAULT_WIDTHS.panel),
  };
}

function storeWidth(column: WorkspaceColumn, value: number) {
  try {
    window.localStorage.setItem(STORAGE_KEYS[column], String(value));
  } catch {
    // Private mode / storage disabled — resizing still works for this session.
  }
}

interface ResizeHandleProps {
  column: WorkspaceColumn;
  width: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

/**
 * The drag handle for a column. It always sits on the column's right edge and
 * always widens that column, so the three handles never compete for the same
 * pixels: the sidebar's handle is on the sidebar, the feed's handle is on the
 * feed, the panel's handle is on the panel's outer edge.
 */
function ResizeHandle({
  column,
  width,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  onDoubleClick,
}: ResizeHandleProps) {
  const range = WORKSPACE_RANGES[column];

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ARIA_LABEL[column]}
      aria-valuemin={range.min}
      aria-valuemax={range.max}
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
        "group absolute inset-y-0 right-0 z-20 w-2.5 touch-none cursor-col-resize outline-none",
        dragging && "bg-primary/5",
      )}
    >
      {/* The hairline that separates the column from the next one. */}
      <div
        className={cn(
          "absolute inset-y-0 right-1 w-px transition-colors duration-150 motion-reduce:transition-none",
          "bg-secondary/20 group-hover:bg-primary/40 group-focus-visible:bg-primary/50",
          dragging && "bg-primary/50",
        )}
      />
      {/* The grip. The columns are empty by design, so without a visible
          handle there is nothing on screen to say "this edge moves". */}
      <div
        className={cn(
          "absolute top-1/2 right-[3px] h-10 w-0.5 -translate-y-1/2 rounded-full transition-colors duration-150 motion-reduce:transition-none",
          "bg-secondary/40 group-hover:bg-primary/60 group-focus-visible:bg-primary/70",
          dragging && "bg-primary/70",
        )}
      />
    </div>
  );
}

/**
 * Desktop workspace chrome: a sidebar to the left of the feed and an assistant
 * panel to its right, with the feed column in between. All three are
 * resizable (pointer, keyboard, double-click to reset) and remember their
 * widths.
 *
 * The columns are empty by design, so the *edge* is what has to read on
 * screen: a soft surface wash, a hairline divider and a visible grip on the
 * hairline. An empty column with only a 4% wash was, in practice, invisible.
 *
 * The fixed chrome inside the feed (the header, the pinned bar, the footers)
 * is positioned against the viewport, so it has to be told where the feed
 * actually is: `--workspace-feed-width` is the feed's width and
 * `--workspace-shift` is how far its centre sits from the viewport's centre.
 * Fixed chrome must use both, or it drifts off the feed.
 *
 * From `WORKSPACE_BREAKPOINT` (1024px) the panels exist. Below it the feed is
 * full width and the layout is the existing mobile-first single column.
 */
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [widths, setWidths] = useState<WorkspaceWidths>(
    WORKSPACE_DEFAULT_WIDTHS,
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState<WorkspaceColumn | null>(null);

  const dragRef = useRef<{
    column: WorkspaceColumn;
    startX: number;
    startWidth: number;
    latestWidth: number;
  } | null>(null);

  // Restore persisted widths, fitted to the current viewport. This has to run
  // after mount: reading localStorage during render would make the first
  // client render disagree with the server HTML and break hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidths(fitWorkspaceWidths(readStoredWidths(), window.innerWidth));
  }, []);

  // Track the breakpoint that decides whether the panels exist.
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

  // Publish the layout to CSS for fixed chrome. The shift is the distance
  // between the viewport centre and the feed centre; the width is the feed's
  // own width, which the fixed chrome has to match or it overflows.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--workspace-feed-width", `${widths.feed}px`);
    root.style.setProperty(
      "--workspace-shift",
      isDesktop ? `${workspaceShift(widths)}px` : "0px",
    );
  }, [widths, isDesktop]);

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
    (column: WorkspaceColumn, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      dragRef.current = {
        column,
        startX: event.clientX,
        startWidth: widths[column],
        latestWidth: widths[column],
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(column);
    },
    [widths],
  );

  const moveResize = useCallback(
    (column: WorkspaceColumn, event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.column !== column) return;

      const range = WORKSPACE_RANGES[column];
      const next = Math.min(
        range.max,
        Math.max(range.min, drag.startWidth + (event.clientX - drag.startX)),
      );

      drag.latestWidth = next;
      setWidths((current) =>
        fitWorkspaceWidths({ ...current, [column]: next }, window.innerWidth, column),
      );
    },
    [],
  );

  const endResize = useCallback(
    (column: WorkspaceColumn, event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.column !== column) return;

      dragRef.current = null;
      setDragging(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      storeWidth(column, drag.latestWidth);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (column: WorkspaceColumn, event: React.KeyboardEvent<HTMLDivElement>) => {
      const range = WORKSPACE_RANGES[column];
      const width = widths[column];
      let next: number | null = null;

      switch (event.key) {
        case "ArrowLeft":
          next = Math.max(range.min, width - 16);
          break;
        case "ArrowRight":
          next = Math.min(range.max, width + 16);
          break;
        case "Home":
          next = range.min;
          break;
        case "End":
          next = range.max;
          break;
        default:
          return;
      }

      event.preventDefault();
      const fitted = fitWorkspaceWidths(
        { ...widths, [column]: next },
        window.innerWidth,
        column,
      );
      setWidths(fitted);
      storeWidth(column, fitted[column]);
    },
    [widths],
  );

  const resetWidth = useCallback(
    (column: WorkspaceColumn) => {
      const range = WORKSPACE_RANGES[column];
      const fitted = fitWorkspaceWidths(
        { ...widths, [column]: range.default },
        window.innerWidth,
        column,
      );
      setWidths(fitted);
      storeWidth(column, fitted[column]);
    },
    [widths],
  );

  return (
    <div className="flex w-full justify-center items-start">
      <aside
        aria-label="Sidebar"
        style={{ width: widths.sidebar }}
        className={cn(
          "relative hidden",
          WORKSPACE_DESKTOP_CLASS,
          "h-dvh shrink-0 flex-col border-r border-secondary/20 bg-secondary/[0.07]",
        )}
      >
        <ResizeHandle
          column="sidebar"
          width={widths.sidebar}
          dragging={dragging === "sidebar"}
          onPointerDown={(event) => startResize("sidebar", event)}
          onPointerMove={(event) => moveResize("sidebar", event)}
          onPointerUp={(event) => endResize("sidebar", event)}
          onKeyDown={(event) => handleKeyDown("sidebar", event)}
          onDoubleClick={() => resetWidth("sidebar")}
        />
      </aside>

      {/* The feed column. Its width is the shell's business, so the fixed
          chrome inside it can be positioned against it. */}
      <div
        className={cn(
          "relative w-full shrink-0",
          WORKSPACE_DESKTOP_WIDTH_CLASS,
        )}
      >
        {children}

        <ResizeHandle
          column="feed"
          width={widths.feed}
          dragging={dragging === "feed"}
          onPointerDown={(event) => startResize("feed", event)}
          onPointerMove={(event) => moveResize("feed", event)}
          onPointerUp={(event) => endResize("feed", event)}
          onKeyDown={(event) => handleKeyDown("feed", event)}
          onDoubleClick={() => resetWidth("feed")}
        />
      </div>

      <aside
        aria-label="Assistant panel"
        style={{ width: widths.panel }}
        className={cn(
          "relative hidden",
          WORKSPACE_DESKTOP_CLASS,
          "h-dvh shrink-0 flex-col border-l border-secondary/20 bg-secondary/[0.07]",
        )}
      >
        <ResizeHandle
          column="panel"
          width={widths.panel}
          dragging={dragging === "panel"}
          onPointerDown={(event) => startResize("panel", event)}
          onPointerMove={(event) => moveResize("panel", event)}
          onPointerUp={(event) => endResize("panel", event)}
          onKeyDown={(event) => handleKeyDown("panel", event)}
          onDoubleClick={() => resetWidth("panel")}
        />
      </aside>
    </div>
  );
}
