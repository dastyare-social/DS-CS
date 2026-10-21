"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  WORKSPACE_BREAKPOINT,
  WORKSPACE_DESKTOP_CLASS,
  WORKSPACE_PANEL,
  WORKSPACE_SIDEBAR,
  clamp,
  fitWorkspaceWidths,
  panelBudget,
} from "@/lib/workspace-layout";

const STORAGE_KEYS = {
  sidebar: "ds.workspace.sidebar-width",
  panel: "ds.workspace.panel-width",
} as const;

type Side = keyof typeof STORAGE_KEYS;

const CONFIG = {
  sidebar: WORKSPACE_SIDEBAR,
  panel: WORKSPACE_PANEL,
} as const;

const ARIA_LABEL = {
  sidebar: "Resize sidebar",
  panel: "Resize assistant panel",
} as const;

interface Widths {
  sidebar: number;
  panel: number;
}

const DEFAULT_WIDTHS: Widths = {
  sidebar: WORKSPACE_SIDEBAR.default,
  panel: WORKSPACE_PANEL.default,
};

function other(side: Side): Side {
  return side === "sidebar" ? "panel" : "sidebar";
}

function readStoredWidth(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function storeWidth(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private mode / storage disabled — resizing still works for this session.
  }
}

interface ResizeHandleProps {
  side: Side;
  width: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

function ResizeHandle({
  side,
  width,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
  onDoubleClick,
}: ResizeHandleProps) {
  const config = CONFIG[side];

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ARIA_LABEL[side]}
      aria-valuemin={config.min}
      aria-valuemax={config.max}
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
        "group absolute inset-y-0 z-20 w-2.5 touch-none cursor-col-resize outline-none",
        side === "sidebar" ? "right-0" : "left-0",
        dragging && "bg-primary/5",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 w-px transition-colors duration-150 motion-reduce:transition-none",
          side === "sidebar" ? "right-1" : "left-1",
          "bg-secondary/20 group-hover:bg-primary/40 group-focus-visible:bg-primary/50",
          dragging && "bg-primary/50",
        )}
      />
      {/* The grip. The panels are empty by design, so without a visible handle
          there is nothing on screen to say "this edge moves". */}
      <div
        className={cn(
          "absolute top-1/2 h-10 w-0.5 -translate-y-1/2 rounded-full transition-colors duration-150 motion-reduce:transition-none",
          side === "sidebar" ? "right-[3px]" : "left-[3px]",
          "bg-secondary/40 group-hover:bg-primary/60 group-focus-visible:bg-primary/70",
          dragging && "bg-primary/70",
        )}
      />
    </div>
  );
}

/**
 * Desktop workspace chrome: an empty sidebar to the left of the feed and an
 * empty assistant panel to its right. Both are resizable (pointer, keyboard,
 * double-click to reset) and remember their widths.
 *
 * The panels are empty by design, so the edge is what has to be seen: a soft
 * surface wash, a hairline divider and a visible grip on the hairline. An
 * empty column with only a 4% wash was, in practice, invisible.
 *
 * From `WORKSPACE_BREAKPOINT` (1024px) the panels exist. The feed's 672px is
 * a ceiling, not a guarantee: between 1024px and 1184px the feed gives up
 * width to the panels, never below 512px. Below the breakpoint the panels are
 * hidden and the existing mobile-first single-column feed is untouched.
 *
 * Fixed, viewport-centred chrome (the pinned bar, the /os error banner) reads
 * `--workspace-shift` to stay aligned with the feed when the panels differ in
 * width.
 */
export default function WorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [widths, setWidths] = useState<Widths>(DEFAULT_WIDTHS);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dragging, setDragging] = useState<Side | null>(null);

  const dragRef = useRef<{
    side: Side;
    startX: number;
    startWidth: number;
    otherWidth: number;
    latestWidth: number;
  } | null>(null);

  // Restore persisted widths, clamped to the current viewport. This has to run
  // after mount: reading localStorage during render would make the first client
  // render disagree with the server HTML and break hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidths(
      fitWorkspaceWidths(
        readStoredWidth(STORAGE_KEYS.sidebar, WORKSPACE_SIDEBAR.default),
        readStoredWidth(STORAGE_KEYS.panel, WORKSPACE_PANEL.default),
        window.innerWidth,
      ),
    );
  }, []);

  // Track the breakpoint that decides whether the panels exist.
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${WORKSPACE_BREAKPOINT}px)`);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Re-clamp both panels when the window shrinks so neither overflows.
  useEffect(() => {
    if (!isDesktop) return;

    const onResize = () =>
      setWidths((current) =>
        fitWorkspaceWidths(current.sidebar, current.panel, window.innerWidth),
      );

    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [isDesktop]);

  // Publish the layout to CSS for fixed chrome. The shift is the distance
  // between the viewport centre and the feed centre.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--workspace-sidebar-width", `${widths.sidebar}px`);
    root.style.setProperty("--workspace-panel-width", `${widths.panel}px`);
    root.style.setProperty(
      "--workspace-shift",
      isDesktop ? `${(widths.sidebar - widths.panel) / 2}px` : "0px",
    );
  }, [widths, isDesktop]);

  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty("--workspace-shift", "0px");
    };
  }, []);

  const maxFor = useCallback((side: Side, otherWidth: number) => {
    const config = CONFIG[side];
    return Math.min(
      config.max,
      Math.max(config.min, panelBudget(window.innerWidth) - otherWidth),
    );
  }, []);

  const setOne = useCallback((side: Side, value: number) => {
    setWidths((current) => ({ ...current, [side]: value }));
  }, []);

  const startResize = useCallback(
    (side: Side, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      const startWidth = widths[side];
      const otherWidth = widths[other(side)];

      dragRef.current = {
        side,
        startX: event.clientX,
        startWidth,
        otherWidth,
        latestWidth: startWidth,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(side);
    },
    [widths],
  );

  const moveResize = useCallback(
    (side: Side, event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.side !== side) return;

      const direction = side === "sidebar" ? 1 : -1;
      const next = clamp(
        drag.startWidth + (event.clientX - drag.startX) * direction,
        CONFIG[side].min,
        maxFor(side, drag.otherWidth),
      );

      drag.latestWidth = next;
      setOne(side, next);
    },
    [maxFor, setOne],
  );

  const endResize = useCallback(
    (side: Side, event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.side !== side) return;

      dragRef.current = null;
      setDragging(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      storeWidth(STORAGE_KEYS[side], drag.latestWidth);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (side: Side, event: React.KeyboardEvent<HTMLDivElement>) => {
      const width = widths[side];
      const max = maxFor(side, widths[other(side)]);
      const direction = side === "sidebar" ? -1 : 1;

      let next: number | null = null;

      switch (event.key) {
        case "ArrowLeft":
          next = clamp(width + direction * 16, CONFIG[side].min, max);
          break;
        case "ArrowRight":
          next = clamp(width - direction * 16, CONFIG[side].min, max);
          break;
        case "Home":
          next = CONFIG[side].min;
          break;
        case "End":
          next = max;
          break;
        default:
          return;
      }

      event.preventDefault();
      setOne(side, next);
      storeWidth(STORAGE_KEYS[side], next);
    },
    [maxFor, setOne, widths],
  );

  const resetWidth = useCallback(
    (side: Side) => {
      const next = clamp(
        CONFIG[side].default,
        CONFIG[side].min,
        maxFor(side, widths[other(side)]),
      );
      setOne(side, next);
      storeWidth(STORAGE_KEYS[side], next);
    },
    [maxFor, setOne, widths],
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
          side="sidebar"
          width={widths.sidebar}
          dragging={dragging === "sidebar"}
          onPointerDown={(event) => startResize("sidebar", event)}
          onPointerMove={(event) => moveResize("sidebar", event)}
          onPointerUp={(event) => endResize("sidebar", event)}
          onKeyDown={(event) => handleKeyDown("sidebar", event)}
          onDoubleClick={() => resetWidth("sidebar")}
        />
      </aside>

      {/* `contents` keeps the page's own fixed chrome and feed column as direct
          flex items, so their positioning and max-width are unchanged. */}
      <div className="contents">{children}</div>

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
          side="panel"
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
