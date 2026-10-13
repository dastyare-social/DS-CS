"use client";

import { useScrollEdges } from "@/lib/hooks/use-scroll-edges";
import type { CSSProperties, RefObject } from "react";

interface ScrollSafeZoneProps {
  /** The scrolling element whose edges should be covered. */
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Space the fixed chrome already covers at the top of the scroller (header,
   * pinned bar). The band starts at the viewport edge and only begins fading
   * once past it, so the seam lands under the chrome instead of just below it.
   * Any CSS length — the feeds publish theirs as `--chat-header-height`.
   */
  topInset?: string;
  /** Same, for the bottom edge. Defaults to no inset. */
  bottomInset?: string;
  /** Suppresses both bands — used while the list is loading or empty. */
  enabled?: boolean;
}

/**
 * The Instagram-style safe zone at each scrollable edge of a list: a gradient
 * that blurs and washes out content where it slides under fixed chrome, so
 * items dissolve into the header and footer instead of being sliced off by a
 * hard line.
 *
 * Each edge is two stacked layers — a blur and a wash — because the blur must
 * deepen on a different curve from the wash (globals.css explains why: masking
 * a blur by alpha `a` gives roughly `√a·radius`, so a linear mask would sit at
 * full strength almost immediately instead of ramping).
 *
 * A band only appears while its own edge has more list behind it. At the start
 * and at the end of the list there is nothing left to fade, so that edge is
 * left clean — which is why the bottom band is absent on first paint and only
 * appears once you have scrolled away from the newest post.
 *
 * Mounted inside a `relative` parent that spans the scroller. Two bands, not
 * one: which edges are live is per-edge state.
 */
export default function ScrollSafeZone({
  scrollRef,
  topInset = "0px",
  bottomInset = "0px",
  enabled = true,
}: ScrollSafeZoneProps) {
  const edges = useScrollEdges(scrollRef);

  if (!enabled) return null;

  return (
    <>
      {/* Two layers per edge. The blur layer carries the ramp; the wash layer
          sits under it at a gentler fade. They are separate because the two
          want different curves — see the tokens in globals.css. */}
      <div
        aria-hidden="true"
        className="scroll-safe-zone-wash"
        style={
          {
            "--scroll-safe-inset": topInset,
            opacity: edges.top ? 1 : 0,
          } as CSSProperties
        }
      />
      <div
        aria-hidden="true"
        className="scroll-safe-zone-blur"
        style={
          {
            "--scroll-safe-inset": topInset,
            opacity: edges.top ? 1 : 0,
          } as CSSProperties
        }
      />

      <div
        aria-hidden="true"
        className="scroll-safe-zone-wash-bottom"
        style={
          {
            "--scroll-safe-inset": bottomInset,
            opacity: edges.bottom ? 1 : 0,
          } as CSSProperties
        }
      />
      <div
        aria-hidden="true"
        className="scroll-safe-zone-blur-bottom"
        style={
          {
            "--scroll-safe-inset": bottomInset,
            opacity: edges.bottom ? 1 : 0,
          } as CSSProperties
        }
      />
    </>
  );
}