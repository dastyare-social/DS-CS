"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface ScrollEdges {
  /** Content is hidden past the top edge — the top band should be showing. */
  top: boolean;
  /** Content is hidden past the bottom edge — the bottom band should be showing. */
  bottom: boolean;
}

/**
 * Slack, in CSS px, around each end of the scroll range, before that end
 * counts as reached.
 *
 * It cannot be a round 1px. `scrollHeight` and `clientHeight` are whole-pixel
 * values and `scrollTop` is clamped to whole *device* pixels, so on a
 * fractional-DPR display the furthest reachable offset lands a pixel or so
 * short of `scrollHeight - clientHeight` — measured at 1.09px on a 1.1x
 * display. Too tight a slack leaves the band stuck on at the very end of the
 * list, which is the one thing it must never do. Scaling by DPR matches the
 * unit the clamp is rounded to, and the floor keeps it comfortable on 1x.
 */
function edgeSlack(): number {
  return Math.max(4, 2 * (window.devicePixelRatio || 1));
}

/**
 * Tracks which edges of a scrolling list currently have content hidden behind
 * them. Drives the `scroll-safe-zone` bands: an edge only gets a band while
 * there is genuinely more list past it, so the start and the end of the list
 * are never covered by a fade that has nothing to fade.
 *
 * Works for both a normal top-to-bottom scroller and a `flex-col-reverse` one
 * (the feeds), where `scrollTop` starts at the visual bottom and runs
 * negative toward the visual top. Direction is read from the element itself
 * rather than passed in, so a caller cannot get it backwards.
 */
export function useScrollEdges(
  scrollRef: RefObject<HTMLElement | null>,
): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ top: false, bottom: false });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Read once — `getComputedStyle` on every scroll frame would force a
    // style recalc per frame for a value that cannot change while mounted.
    const reversed = getComputedStyle(el).flexDirection === "column-reverse";

    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      const slack = edgeSlack();

      // Nothing is scrollable, so neither edge is hiding anything.
      const offset = max > slack ? Math.abs(el.scrollTop) : 0;
      const pastStart = offset > slack;
      const pastEnd = offset < max - slack;

      // `reversed` swaps which end of the scroll range is the visual top:
      // in a column-reverse list the first end reached is the bottom of the
      // screen, so more-past-the-start means content below, not above.
      const next = reversed
        ? { top: pastEnd, bottom: pastStart }
        : { top: pastStart, bottom: pastEnd };

      setEdges((prev) =>
        prev.top === next.top && prev.bottom === next.bottom ? prev : next,
      );
    };

    // Coalesce to one read per frame. A scroll handler that calls setState
    // directly re-renders on every event, and these pages render the whole
    // feed under it.
    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        update();
      });
    };

    el.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // scrollHeight grows without scrollTop changing — posts appended by the
    // infinite scroller, lazy media settling, the pinned bar appearing. The
    // scroller's own border box never resizes for that, so its children are
    // observed instead; they are what actually gets taller.
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);

    update();

    return () => {
      el.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [scrollRef]);

  return edges;
}