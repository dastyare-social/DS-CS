"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import {
  ERROR_BAR_DURATION_MS,
  ERROR_BAR_EVENT,
  type ErrorBarDetail,
} from "@/lib/error-bar";

/**
 * Global transient error bar. Mounted once in
 * `src/app/(routes)/layout.tsx`, fed by `raiseError()` (`@/lib/error-bar`).
 *
 * The bar is deliberately the install banner's twin: same `liquid-glass`
 * material, same `rounded-2xl px-3 py-2` pill, same
 * `px-4 pt-2.5` wrapper, same `max-w-sm`, same `z-40`. Only the contents differ
 * — a message and a dismiss X, no action button. Do not restyle it here;
 * change it in one place for all three bars or none of them.
 *
 * Stacking, bottom-up: footer (`z-50`) → install/update banner (`z-40`) →
 * **this bar** (`z-40`) → scroll-to-bottom button (`z-40`). The last one sits
 * above this bar because its `bottom` adds `--error-bar-height` to the chain.
 *
 * Two CSS variables, both on `:root`, matching the contract the other floating
 * bars already use:
 *
 * - `--error-bar-bottom` — **read**, the distance from the viewport bottom to
 *   the bar's own bottom edge. Each page with bottom chrome sets it to
 *   `calc(<its footer> + <its banner> - 5px)` alongside `--chat-footer-height`.
 *   Unset on chrome-less routes (`/about`, `/os/register`), where the `0px`
 *   fallback parks the bar flush with the screen edge.
 * - `--error-bar-height` — **written** here, so anything stacked above can
 *   offset itself. Reset to `0px` while hidden.
 */
export default function ErrorBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirrors `message` so the event listener — registered once, with an empty
  // dep array — can read what is on screen without re-subscribing per message.
  const shownRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    shownRef.current = null;
    setMessage(null);
  }, [clearTimer]);

  useEffect(() => {
    const onRaise = (event: Event) => {
      const detail = (event as CustomEvent<ErrorBarDetail>).detail;
      const next = detail?.message;
      if (!next) return;

      // Dedupe: the same message already on screen is ignored outright, so a
      // flapping error neither re-renders the bar nor re-arms its timer.
      if (shownRef.current === next) return;

      shownRef.current = next;
      setMessage(next);
      clearTimer();
      timerRef.current = setTimeout(
        hide,
        detail.duration ?? ERROR_BAR_DURATION_MS,
      );
    };

    window.addEventListener(ERROR_BAR_EVENT, onRaise);
    return () => {
      window.removeEventListener(ERROR_BAR_EVENT, onRaise);
      clearTimer();
    };
  }, [clearTimer, hide]);

  // Self-report height via CSS variable so anything stacked above — the
  // scroll-to-bottom button, the feed's bottom padding, the scroll safe zone —
  // can offset itself. Mirrors the install and update banners exactly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = barRef.current;
    if (!message || !el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--error-bar-height",
        `${el.offsetHeight}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--error-bar-height", "0px");
    };
  }, [message]);

  if (typeof window === "undefined" || !message) return null;

  return (
    <div
      ref={barRef}
      // Centred on the feed, not on the window: the workspace shift is how far
      // the feed's centre sits from the viewport's centre.
      style={{ marginLeft: "var(--workspace-shift, 0px)" }}
      className="fixed bottom-[var(--error-bar-bottom,0px)] left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-4 pt-2.5"
    >
      <div
        role="alert"
        className="liquid-glass w-full flex items-center gap-x-2.5 rounded-2xl px-3 py-2"
      >
        <p className="flex-1 min-w-0 text-[15px] text-secondary/90">
          {message}
        </p>
        <XIcon
          onClick={hide}
          className="size-4 stroke-[1.5px] cursor-pointer shrink-0"
        />
      </div>
    </div>
  );
}
