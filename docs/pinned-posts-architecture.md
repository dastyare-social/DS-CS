# Pinned Posts Architecture

Internal developer reference. Explains how pinned posts work, why the code is shaped the way it is, and how to fix common issues.

---

## Files involved

| File | Role |
|---|---|
| `src/components/pinned-bar.tsx` | Shared UI component - the floating bar at top showing pinned post preview, count, and unpin button |
| `src/app/(routes)/(main)/page.tsx` | HOME page - fetches pinned posts, manages cycle + display state, scroll detection |
| `src/app/(routes)/os/(routes)/(main)/page.tsx` | OS (admin) page - same pinned logic plus optimistic pin/unpin mutations |
| `src/lib/actions/posts.ts` | Server action `getPinnedPosts()` - fetches pinned posts from DB |
| `src/lib/api/posts/queries.ts` | DB query `getPinnedPosts()` |

---

## Core architecture: two separate concerns

The pinned bar has **two independent state trackers** that must never be mixed:

### 1. `cycleIndexRef` (ref, not state)

- Tracks **which pinned post the user wants to jump to next**
- Only changes when the user **taps the pinned bar**
- Starts at `-1` so the first tap goes to index 0 (the first pinned post)
- Wrapped in `useRef` so it doesn't cause re-renders and isn't affected by scroll events
- Also clamped in the `useEffect` that watches `pinnedPosts.length`

### 2. `displayIndex` (React state)

- Tracks **what the bar currently shows** (e.g., "Pinned Post - 2/3")
- Updated by **two sources**:
  - **User tap**: `handleCyclePinned` sets it to match `cycleIndexRef`
  - **User scroll**: scroll visibility handler detects which pinned post is most visible in the viewport and updates it
- Rendered by `<PinnedBar activeIndex={displayIndex} />`

### Why two separate things?

If we only had one variable for both cycling and display, the scroll handler would fight the click handler. When you click to go to post 2, the smooth scroll fires intermediate scroll events that the handler interprets as "user scrolled away" and resets the index back. Telegram solved this the same way - with a programmatic scroll lock.

---

## Programmatic scroll lock

When the user taps the pinned bar and we `scrollIntoView`, we set `programmaticScrollRef.current = true`. While this is true:

- The scroll visibility handler **skips** updating `displayIndex`
- This prevents the scroll animation from resetting the display back to the old pinned post

The lock is released on the `scrollend` event (Chrome 114+, Firefox 109+, Safari 26.2+) with a timeout fallback (3000ms) for older browsers.

```
User taps bar
  -> cycleIndexRef advances
  -> displayIndex set to match
  -> programmaticScrollRef = true
  -> scrollIntoView starts
  -> scrollend fires (or timeout)
  -> programmaticScrollRef = false
```

---

## Scroll visibility detection

Runs on every scroll event (passive listener) inside the scroll container. For each pinned post:

1. Get its DOM element via `document.getElementById("message-" + pinnedPosts[i].id)`
2. Calculate how many pixels of it are visible inside the scroll container
3. Pick the one with the most visible pixels
4. **Only update `displayIndex` if the best visibility is >= 10px** - this prevents random jumps when no pinned post is meaningfully in view

If no pinned post has >= 10px visible, the display stays at whatever it was last set to.

---

## PinnedBar component

- Renders as a `fixed` element at `top: var(--chat-header-height)`
- Uses `ResizeObserver` to self-report its height as `--pinned-bar-height` CSS variable
- Pages use `pt-[calc(var(--chat-header-height)+var(--pinned-bar-height,0px))]` on the scroll container to prevent posts from hiding behind the bar
- When there are 0 pinned posts, returns `null` (renders nothing) and sets `--pinned-bar-height` to `0px`

---

## Scroll-to-post

The `scrollToPost` function (in both pages):

1. Looks for `document.getElementById("message-" + targetId)`
2. If not found and there are more pages to load, calls `loadMore()` in a retry loop (up to 20 attempts, 200ms apart)
3. Once found, sets `programmaticScrollRef = true`
4. Calls `el.scrollIntoView({ behavior: "smooth", block: "center" })`
5. Sets highlight on the target post (ring + bg color for 3 seconds)
6. Releases the lock on `scrollend` or timeout

---

## CSS variables

| Variable | Set by | Used by |
|---|---|---|
| `--chat-header-height` | `updateHeaderFooterOffsets()` in page | PinnedBar `top`, scroll container `pt` |
| `--chat-footer-height` | `updateHeaderFooterOffsets()` in page | scroll container `pb` |
| `--pinned-bar-height` | PinnedBar via ResizeObserver | scroll container `pt` (calc with header) |
| `--page-height` | `updatePageHeight()` | scroll container `min-h` |

---

## Common bugs and fixes

### "First click goes to 2/x instead of 1/x"

**Cause**: `cycleIndexRef` starts at `0`, so `(0 + 1) % n = 1`.
**Fix**: `cycleIndexRef` must start at `-1`. First click: `(-1 + 1) % n = 0`.

### "Clicking pinned bar doesn't scroll / gets stuck"

**Cause**: `scrollToPost` can't find the element (`document.getElementById` returns null). The pinned post might not be in the currently loaded posts.
**Fix**: Make sure `scrollToPost` has the retry loop that calls `loadMore()` when the element isn't found.

### "Display index jumps randomly while scrolling (3->1->2)"

**Cause**: The scroll visibility handler fires on every scroll event and picks up posts that are barely visible (< 1px due to rounding).
**Fix**: Add a minimum visibility threshold (`>= 10px`) before updating `displayIndex`.

### "Display resets during programmatic scroll"

**Cause**: The scroll handler isn't checking `programmaticScrollRef` before updating.
**Fix**: Add `if (programmaticScrollRef.current) return;` at the top of the scroll handler.

### "Click doesn't advance - stuck on same post"

**Cause**: `handleCyclePinned` reads a stale `activePinnedIndex` due to closure issues, OR the scroll handler is resetting the index mid-animation.
**Fix**: Use `cycleIndexRef` (a ref) for cycling, not state. The ref is always current regardless of render cycle.

### "Posts hidden behind pinned bar"

**Cause**: `--pinned-bar-height` CSS variable is not defined or not used in the padding calc.
**Fix**: PinnedBar must use `ResizeObserver` to set `--pinned-bar-height`. Scroll container must use `pt-[calc(var(--chat-header-height)+var(--pinned-bar-height,0px))]`.

### "Pinned badge not showing on HOME page"

**Cause**: `<Post>` component missing `pinned` prop.
**Fix**: Add `pinned={msg.pinnedAt != null}` to `<Post>` in the HOME page.

### "Cycle index goes out of bounds after unpin"

**Cause**: `cycleIndexRef` not clamped when pinned list shrinks.
**Fix**: The `useEffect` watching `pinnedPosts.length` must clamp both `displayIndex` and `cycleIndexRef.current`.

---

## How it was built (decision log)

1. **Initial approach**: Single `activePinnedIndex` state driven by both click and scroll. This caused race conditions - scroll events during programmatic animation would reset the index.

2. **Second approach**: Added `suppressScrollRef` to ignore scroll events during animation. This helped but had timing issues - the 800ms timeout was a guess, not event-driven.

3. **Third approach**: Used `scrollend` event with timeout fallback for the lock. Still had the single-variable problem.

4. **Final approach (current)**: Separated into `cycleIndexRef` (ref, click-driven) + `displayIndex` (state, scroll+click-driven). Scroll visibility only updates display, never cycle. Cycle ref is always current. No race conditions by construction.

The research that informed this covered Telegram's source code (tweb pinnedMessage.tsx), Element/Matrix ScrollPanel docs, WhatsApp/Discord pinned message UX, and TanStack Virtual chat patterns.
