# Design System — Dastyare Social CS

Styling rules for this app. The source of truth is
`src/styles/globals.css` — this document describes it; it does not replace it.

Live components are also published to Storybook under the `Design System/*`
namespace (`src/components/*.stories.tsx`), including
`Design System/Liquid Glass`, which renders every material over a busy
backdrop. Glass is invisible on flat white, so use that story to review it
rather than an isolated white canvas.

---

## 1. Token architecture

Tokens live in two layers, and the split matters:

| Layer | Location | Consumed as |
|-------|----------|-------------|
| Raw values | `:root` in `globals.css` | referenced by other tokens |
| Tailwind mapping | `@theme inline` | `bg-*`, `text-*`, `border-*` utilities |

`@theme inline` re-exports raw tokens under Tailwind's colour namespace so
they resolve to the live value rather than being frozen at build time:

```css
@theme inline {
  --color-button-background: var(--button-background);
}

:root {
  --button-background: color-mix(in srgb, var(--primary) 10%, transparent);
}
```

**Rule:** add new tokens to `:root`. Add an `@theme inline` mapping only when
a Tailwind utility should be able to reach it.

### Current tokens

| Token | Value | Notes |
|-------|-------|-------|
| `--background` | `oklch(0.99 0 0)` | page base |
| `--foreground` | `oklch(0.44 0.01 286)` | body text |
| `--primary` | `oklch(0.65 0.19 41)` | actions / accents |
| `--secondary` | `oklch(0.44 0.01 286)` | |
| `--button-background` | `primary` @ 10% | |
| `--button-foreground` | `primary` | |
| `--button-border` | `primary` @ 15% | |
| `--icon-background` | `primary` @ 10% | |
| `--icon-foreground` | `primary` | |
| `--icon-border` | `primary` @ 15% | |
| `--selection-foreground` / `--selection-background` | `primary` / `primary` @ 10% | |

Material tokens (`--liquid-glass-*`, `--scroll-fade-*`) are documented with
the utility that consumes them, in §4, §5 and §6.

---

## 2. No shadows — global rule

**The application renders no shadows, anywhere. This is not a per-component
convention; it is enforced for the whole codebase.**

- No `box-shadow` — no outer drop shadow.
- No `text-shadow`.
- No `drop-shadow` filter.
- No depth. Surfaces sit **flush** with the page and never lift off it.

There is exactly one sanctioned exception: the inset stroke on
`.liquid-glass` (§2.1). It casts nothing outside its own element, so the
no-depth rule still holds everywhere.

### Enforcement

`src/styles/globals.css` declares an unlayered reset:

```css
*:not(.liquid-glass),
::before,
::after {
  box-shadow: none;
  text-shadow: none;
}
```

It is unlayered on purpose. Tailwind puts its `shadow-*` utilities in
`@layer utilities`, and **layer order beats specificity** — a reset written
inside `@layer base` would still lose to `shadow-lg`. Only an unlayered
declaration outranks every layer, which is what makes the rule unbypassable
by simply adding a utility class.

Consequently `shadow-*` classes in `className` are harmless no-ops: they
compile and type-check normally but render nothing. They should still be
removed for clarity, since they misdescribe intent.

`drop-shadow` is not covered by the reset — it is a `filter`, and forcing
`filter: none` globally would break every `backdrop-filter` in the app.
Avoid it in review instead.

### 2.1 The liquid-glass inset stroke

`.liquid-glass` is the only element permitted a `box-shadow`, and only as an
**inset** stroke:

```css
box-shadow: inset 0 0 var(--liquid-glass-stroke-blur) 0
  color-mix(in srgb, var(--liquid-glass-stroke) var(--liquid-glass-stroke-opacity), transparent);
```

A blurred inset ring is the CSS equivalent of Figma's **Inner shadow**
effect applied to a stroke. It is what gives the rim its smoothed edge
instead of a hard 1px line — hence "iOS smoothing".

Why this is compatible with the rule: `inset` shadows fade **inward**. They
cannot cast outside the element, so the surface still sits flush and gains
no depth. An outer shadow would break the rule outright.

| Token | Default | Controls |
|-------|---------|----------|
| `--liquid-glass-stroke` | `white` | rim colour |
| `--liquid-glass-stroke-opacity` | `60%` | rim strength |
| `--liquid-glass-stroke-blur` | `2px` | edge softness — raise it for a softer rim |

The stroke and the border are **separate and complementary**. `--liquid-glass-border-color`
sets edge weight to match the install/update/error bars
(`border-secondary/5`); the stroke adds the luminous rim that makes the pane
read as glass. Do not merge them.

`::before` / `::after` remain fully reset, so the exception applies to the
element itself only — the sheen pseudo-element can never take a shadow.

### The rationale

Conventional card styling separates a surface with a drop shadow. This
codebase does not. Separation and hierarchy come from blur, translucency,
wash gradients, rim borders and contrast — never from elevation.

If a surface genuinely needs to read as raised, the answer is a different
material built from those tools, **not** a shadow.

---

## 3. Corners — plain border-radius

**Corners are plain `border-radius`. No `corner-shape` is applied anywhere in
this app, and the radius scale is not overridden.**

`rounded-*` is stock Tailwind v4:

| utility | radius |
|---|---|
| `rounded-sm` | 4px |
| `rounded-md` | 6px |
| `rounded-lg` | 8px |
| `rounded-xl` | 12px |
| `rounded-2xl` | 16px |
| `rounded-3xl` | 24px |
| `rounded-4xl` | 32px |
| `rounded-full` | 50% (true circle) |

To change a corner, change `rounded-*` at the call site. Never override the
scale globally.

### Corner smoothing was tried and removed

Figma/iOS "corner smoothing" is the continuous squircle corner. The only CSS
route to it is `corner-shape: superellipse(n)`, where **n is an exponent, not
a percentage** — `n = 2` is a circular arc, above 2 is a squircle, below 2 cuts
the corner inward into an octagon.

It was applied app-wide and then removed, because in practice it read as a
change to corner **size** rather than shape and could not be reconciled with
the previous look. Two radius-compensation scales were tried on top of it —
×1.21 derived from the diagonal-reach geometry, then ×1.15 — and both visibly
oversized every corner, worst on the short full-bleed bars (pinned-posts bar,
install/update/error bars) where the radius approaches half the element height.
All of it is gone.

If this is revisited, two things worth knowing:

- **Do not use the `@toolwind/corner-shape` npm package.** It is a `0.0.8-3`
  pre-release whose `superellipse` support is commented out in its own source —
  it only ships `round`/`scoop`/`bevel`/`notch`/`square`/`squircle` keywords. It
  also imports `@toolwind/v4-modifier-parser` without declaring it as a
  dependency or peer, so installing it breaks the Tailwind build.
- Use the native property directly, and scope it to the surfaces that need it
  rather than setting it on `*`.

---

## 4. Liquid Glass

A reusable translucent material for buttons, cards, panels and any other
surface that should read as glass. Defined once as the `.liquid-glass`
utility; tint it per surface by overriding tokens, never by restating the
effect. Inherits §2 — it carries no shadow.

```tsx
<div className="liquid-glass rounded-2xl px-6 py-4">…</div>

// tinted via tokens only
<div className="liquid-glass [--liquid-glass-bg:color-mix(in_srgb,var(--primary)_22%,transparent)]" />
```

### 4.1 What the material is made of

Only four things, in this order:

1. `backdrop-filter: blur() saturate()` — the refraction
2. A vertical wash gradient — lit at the top, cooler at the bottom
3. A translucent `background-color`
4. A rim from `border-width` + `border-color`

### 4.2 Tokens

All overridable per surface.

| Token | Default | Controls |
|-------|---------|----------|
| `--liquid-glass-blur` | `2px` | refraction radius |
| `--liquid-glass-saturate` | `180%` | vibrancy behind the glass |
| `--liquid-glass-bg` | `white` @ 55% | base tint |
| `--liquid-glass-wash-top` | `white` @ 65% | gradient top |
| `--liquid-glass-wash-bottom` | `white` @ 15% | gradient bottom |
| `--liquid-glass-border-width` | `1px` | rim thickness |
| `--liquid-glass-border-color` | `--secondary` @ 5% | rim colour — a dark hairline, not a white rim (this app is light-only, so a white rim is invisible); matches `border-secondary/5`, the rim the install/update/error bars use |
| `--liquid-glass-sheen` | `white` @ 70% | hover highlight |
| `--liquid-glass-stroke` | `white` | Figma-style inset stroke (§2.1) |
| `--liquid-glass-stroke-opacity` | `60%` | inset stroke strength |
| `--liquid-glass-stroke-blur` | `2px` | inset stroke softness |

Common overrides:

```tsx
// crisper, less frosted
"[--liquid-glass-blur:4px]"
// heavier frost
"[--liquid-glass-blur:40px] [--liquid-glass-saturate:300%]"
// thicker rim
"[--liquid-glass-border-width:3px] [--liquid-glass-border-color:#fff]"
```

### 4.3 Dark glass (`liquid-glass-dark`)

For surfaces that float **on media** — photo/video overlay pills, progress
rings, play buttons, image badges — rather than on the app background.

```tsx
<div className="liquid-glass-dark rounded-full px-1.5 py-0.5 text-white" />
```

It is self-contained (it applies the material itself, via `@apply`), so it
is used **alone**, never paired with `liquid-glass`. The default tokens
cannot be reused there: a white wash over a photo destroys the white-text
contrast these rely on. The variant inverts the tint and rim so the surface
stays legible against any frame while reading as the same material.

| Token | Dark default |
|-------|--------------|
| `--liquid-glass-blur` | `8px` |
| `--liquid-glass-saturate` | `140%` |
| `--liquid-glass-bg` | `black` @ 32% |
| `--liquid-glass-wash-top` | `white` @ 22% |
| `--liquid-glass-wash-bottom` | `black` @ 18% |
| `--liquid-glass-border-color` | `white` @ 18% |
| `--liquid-glass-stroke-opacity` | `60%` |

Per-surface overrides still work exactly as with `liquid-glass`, which is how
the media carousel dots express their active/inactive states.

**Choosing between them:** on the app background or over app chrome →
`liquid-glass`. Over a photo or video frame → `liquid-glass-dark`.

### 4.4 Hover sheen

A `::before` radial highlight fades in on `:hover` / `:focus-visible`. It is
opacity `0` at rest and carries no shadow, so it does not violate §2. The
transition is disabled under `prefers-reduced-motion: reduce`.

`isolation: isolate` is required on the utility — the sheen's negative
`z-index` must stay inside the element rather than falling behind the page
background. Do not remove it.

### 4.5 Reflection

Every glass surface carries a specular reflection via `::after`: **45°, full
scale, zero dispersion, zero frost** — one colour with hard gradient stops, so
it reads as a reflection rather than a glow or a lens flare.

| Token | Default |
|-------|---------|
| `--liquid-glass-reflection-angle` | `45deg` |
| `--liquid-glass-reflection-color` | `white` @ 55% |
| `--liquid-glass-reflection-opacity` | `45%` |

`liquid-glass-dark` overrides these so the band reads as a highlight on a dark
pane. Dispersion (chromatic split) and frost (blur) are deliberately absent —
the band is a single gradient with no `filter: blur()`.

On a light surface the band is assertive at the default opacity. Drop
`--liquid-glass-reflection-opacity` to ~25% if a panel looks washed out.

### 4.6 Never combine `liquid-glass` with `progress-ring` on one element

This is a hard constraint, not a style preference.

Both classes paint through `::before`:

- `.liquid-glass::before` — the hover sheen, `z-index: -1`, `opacity: 0`
- `.progress-ring::before` — the conic progress arc, masked to a thin ring

On one element the two rules target **the same pseudo-element**, so the
sheen's `opacity: 0` wins and the ring never renders — no arc, at any
progress value. Nest the ring inside the glass chip instead:

```tsx
// ✗ ring is invisible at every progress value
<div className="liquid-glass-dark progress-ring progress-ring-sm" />

// ✓
<div className="liquid-glass-dark rounded-full size-10 relative grid place-items-center">
  <span className="progress-ring progress-ring-sm absolute inset-0 rounded-full" />
</div>
```

### 4.7 The progress ring is drawn inside the element

`.progress-ring::before` uses `inset: 0`, not a negative inset. An element
carrying `backdrop-filter` becomes its own compositing layer and clips
descendants to its border box, so a ring drawn at `inset: -2px` is clipped
away entirely. Keep the ring inside.

### 4.8 Do not pass `backdrop-blur-*` alongside the utility

Tailwind's `backdrop-blur-*` emits a bare `backdrop-filter` at the same
specificity but later in the utilities layer, so it clobbers the composite
filter and silently drops the `saturate()` leg. Some existing call sites
still do this; the utility defends against it by re-declaring the filter
under `&.liquid-glass`.

New code should not pass `backdrop-blur-*` or `bg-*` to a `.liquid-glass`
element. Override the tokens instead.

---

## 5. Scroll safe zone

`scroll-safe-zone-*` — `src/components/scroll-safe-zone.tsx`. The band that
hides the seam where a scrolling list runs under fixed chrome, so items
dissolve into the header and footer instead of being sliced off by a hard
line.

It is deliberately **not** glass. It has no rim, no inset stroke and no
specular band: its job is to dissolve content, not to read as a surface.

| Token | Default |
|-------|---------|
| `--scroll-safe-inset` | `0px` |
| `--scroll-fade-size` | `76px` |
| `--scroll-fade-blur` | `2px` |
| `--scroll-fade-wash` | `--background` @ 40% |

`--scroll-fade-blur` is the **ceiling**, and it is deliberately low. The band is
meant to soften the seam, not to erase what it covers — anything stronger reads
as the chrome frosting the list rather than the list receding behind it.

### 5.1 Each edge is two layers, not one

The blur and the wash are separate elements — `scroll-safe-zone-blur` and
`scroll-safe-zone-wash` — because they want **different fade curves**.

Masking a blur by alpha `a` composites it as `a·blur_B(S) + (1-a)·S`. Because a
blur is a linear operator, that is equivalent to a blur of roughly `√a·B`. So
with a *linear* mask the radius goes as `√a`: it is already at ~95% of the
ceiling after the first 10% of the band and then crawls for the rest. It reads
as a flat blur with a fade laid over it, not as a blur that deepens.

The blur layer therefore masks on **`(1-s)²`**, so `√a = 1-s` and the radius
falls evenly from the ceiling to nothing:

| depth into band | mask alpha | implied radius |
|-----------------|-----------|----------------|
| 0 (screen edge) | 1 | 2.00px |
| 0.25 | 0.5625 | 1.50px |
| 0.50 | 0.25 | 1.00px |
| 0.75 | 0.0625 | 0.50px |
| 1.00 | 0 | 0px |

The wash keeps a gentler linear ramp — it has no sharpness to lose, and holding
it back lets the blur read as the thing doing the work. A sharp wash fade would
leave crisp text ghosting through at half strength.

### 5.2 The fade runs from the screen edge, not from under the chrome

The band has **no opaque prefix**. An earlier version held full strength across
`--scroll-safe-inset` and only ramped below it, which buried the strongest part
of the blur behind the header/footer — so content appeared at its blurriest
exactly where it emerged from under the chrome. Ramping from the screen edge
means it is already easing off by the time it comes into view.

`--scroll-safe-inset` therefore only *sizes* the band: it is how far past the
chrome the fade has to run before it reaches nothing.

Callers pass **half** the floating bar's height as part of the inset, so the
fade is measured against the middle of the pinned bar at the top and the middle
of the install/update/error bar at the bottom:

```tsx
topInset="calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) / 2)"
bottomInset="calc(
  var(--chat-footer-height)
  + (var(--install-banner-height, 0px) + var(--error-bar-height, 0px)) / 2
)"
```

### 5.3 The mask is composed in the utility, not in a token

A `var()` nested inside a custom property resolves against the element that
**declares** it, not the element that inherits it. A `--scroll-fade-mask-*`
token in `:root` would therefore bake in `:root`'s `--scroll-safe-inset`, and
every per-surface override would be silently ignored. Same split `liquid-glass`
already uses: scalar colours as tokens, gradient as composition.

Each concrete layer also declares its own anchoring (`top: 0` / `bottom: 0`)
rather than inheriting one and overriding it — two same-specificity rules
otherwise resolve by source order, which the build does not guarantee.

### 5.4 Per-edge visibility is the caller's business

`useScrollEdges` (`src/lib/hooks/use-scroll-edges.ts`) reports, per edge,
whether there is list hidden behind it. `ScrollSafeZone` drives each layer's
`opacity` from that, so **an edge with nothing behind it is never covered by a
fade that has nothing to fade** — the start and the end of a list stay clean.
The utility itself does not decide this.

The hook handles both a normal scroller and `flex-col-reverse` (the feeds,
where `scrollTop` starts at the visual bottom and runs negative) by reading
`flex-direction` off the element, so a call site cannot get it backwards.

Its edge slack is DPR-scaled. `scrollHeight`/`clientHeight` are whole CSS
pixels and `scrollTop` is clamped to whole *device* pixels, so on a
fractional-DPR display the furthest reachable offset lands a pixel or two
short of `scrollHeight - clientHeight` — measured at 1.09px at 1.1x. A 1px
slack leaves the band stuck on at the very end of the list.

---

## 6. Bottom floating bars — install, update, error

Three bars stack above the bottom edge, in this order. They share one shape and
one contract:

| Bar | File | Lives on | Height variable | Auto-dismiss |
|-----|------|----------|------------------|--------------|
| Install | `install-banner.tsx` | `/` (public feed) | `--install-banner-height` | no — persists until dismissed |
| Update | `update-banner.tsx` | `/os` | `--update-banner-height` | no — persists until dismissed |
| Error | `error-bar.tsx` | **every route** | `--error-bar-height` | yes — 4s |

All three are the same element. Identical `liquid-glass`, `rounded-2xl px-3
py-2` pill, identical `px-4 pt-2.5` wrapper, identical `max-w-sm`, identical
`z-40`. Only the contents differ: the install and update bars carry a message,
an action `Button` and an `X`; the error bar carries a message and an `X`.

**Change the shared look in all three, or in none.** Restyling one of them
breaks the stack into two different bars.

```tsx
<div className="fixed bottom-[...] left-1/2 -translate-x-1/2 w-full max-w-sm z-40 px-4 pt-2.5">
  <div className="liquid-glass w-full flex items-center gap-x-2.5 rounded-2xl px-3 py-2">
    <p className="flex-1 min-w-0 text-[15px] text-secondary/90">{message}</p>
    <XIcon className="size-4 stroke-[1.5px] cursor-pointer shrink-0" />
  </div>
</div>
```

### 6.1 The height-variable contract

Every bar **writes** its own height to `:root` through a `ResizeObserver` and
resets it to `0px` while hidden, so whatever sits above it can offset itself.
Three kinds of consumer, in order of who has to know:

| Consumer | Adds up |
|----------|---------|
| a bar's own `bottom` | the heights of the bars **below** it |
| the scroll-to-bottom button | footer + every bar below it |
| the feed's `pb`, and the scroll safe zone's `bottomInset` | footer + every bar below it |

The `- 5px` in every one of those offsets is a deliberate overlap (§5.4).

The error bar is the odd one out: its own `bottom` comes from a variable it
does **not** write, because only the page knows its footer.

| Variable | Read/write | Meaning |
|----------|------------|---------|
| `--error-bar-height` | written by the bar | its height, so things above can offset |
| `--error-bar-bottom` | **written by the page**, read by the bar | distance from the viewport bottom to the bar's own bottom edge |

`--error-bar-bottom` is page-owned on purpose rather than derived inside the
bar from `--chat-footer-height`. Deriving it would inherit the staleness that
affects every other one of these variables: a page that never sets
`--chat-footer-height` (`/about`, `/os/register`) would silently inherit the
last value a footer page left behind and park the bar in mid-screen. A
variable a page only writes when it *has* chrome cannot go stale, and its
`0px` fallback covers the chrome-less routes.

Adding a page with bottom chrome means two edits, both next to the existing
`--chat-footer-height` write in that page's `updateHeaderFooterOffsets`:

```ts
document.documentElement.style.setProperty(
  "--error-bar-bottom",
  "calc(var(--chat-footer-height) + var(--install-banner-height, 0px) - 5px)"
);
```

...then `--error-bar-height` into that page's feed `pb`, its scroll safe zone
`bottomInset`, and its scroll-to-bottom `bottom`. Routes wired today: `/`,
`/os`, `/explore`, `/posts/[post_id]`.

### 6.2 Raising an error

`raiseError()` — `src/lib/error-bar.ts` — is the only entry point:

```tsx
import { raiseError } from "@/lib/error-bar";

try {
  await createPost({ content });
} catch (err) {
  raiseError(err);
}
```

The bar is mounted once in `src/app/(routes)/layout.tsx`, so nothing has to
thread a callback or a context to reach it. `raiseError` dispatches a
namespaced `window` event (`dastyare:error-bar`), which crosses server/client
component boundaries and reaches into plain callbacks inside hooks and stores.
It is a no-op on the server, and on `null` / `undefined` / blank messages — so
a nullable message can be passed straight through without a guard.

| Argument | Default | Notes |
|----------|---------|-------|
| `error` | — | an `Error`, a `string`, or anything else |
| `fallback` | `"Operation failed"` | used only for a non-string, non-`Error` throw; pass a localized string when `t()` is in scope — `t("general.error_generic")` |
| `duration` | `4000` ms | auto-dismiss override |

**Behaviour.** A new message replaces the current one and restarts the timer.
Repeating the message already on screen is a **complete no-op** — no replace,
no timer reset — so a retry loop that throws the same error every two seconds
cannot hold the bar open forever. `X` dismisses early and clears the pending
timer. The bar carries `role="alert"`, so it is announced.

### 6.3 Transient or static — which errors get the bar

The bar is for failures worth telling the user about but not worth holding the
screen for. That is a narrower set than "every error".

| Use the bar | Keep its own surface |
|-------------|----------------------|
| rejected writes (create / update / delete / pin) | form validation — the field is right there |
| rejected attachment selections | per-attachment upload chips, which carry their own retry |
| any rejected call with no better home | persistent load / publish error screens |

The rule of thumb: **if the user can act on it in place, it stays in place.**
The bar is a heads-up, not a state.

Two surfaces were absorbed into the bar when it landed — the 5s red write-error
toast at the top of `/os`, and the 4s rejected-files notice inline in that
composer. Both were transient, both were the only error UI on their path, and
both are now `raiseError()` calls.

---

## 7. Loading images — `LazyImageLoader`

`src/components/lazy-image-loader.tsx`. Stacks a WebGL shader *under* an
existing loader, so media that resolves quickly never allocates GPU work.

```tsx
<LazyImageLoader>
  <Loader className="size-10" />
</LazyImageLoader>
```

Three rules:

- **Armed only after a delay (default 300ms).** If the media resolves first,
  nothing mounts. This is what keeps a fast feed off the GPU.
- **`img-fx` is loaded with `next/dynamic` and `ssr: false`.** It pulls in
  `three` and touches WebGL; it must never run on the server.
- **The existing `Loader` is kept on top.** The shader is an addition, not a
  replacement — do not delete the CSS spinner.

`img-fx` renders every instance through a **single shared
`THREE.WebGLRenderer`** with an `instances: Set`, and its rAF loop sleeps when
nothing is visible. Many mounted instances are therefore cheap, but the 300ms
delay is still what keeps a feed of fast-loading media off the GPU entirely.

Cost to be aware of when adding it somewhere new: `three` is ~20MB unpacked
on disk.

---

## 8. Button

`src/components/button.tsx`. `buttonVariants` is `cva`; `asChild` renders
through a Radix `Slot`.

Both variants carry `liquid-glass` from the base class and only re-tint:

| Variant | Tint | Rim |
|---------|------|-----|
| `primary` | `--button-background` | `--button-border` |
| `secondary` | `button-background` @ 20% | `button-border` @ 50%, `2px` |

Rule: a variant may only set `--liquid-glass-*` tokens. Adding a shadow or a
`backdrop-filter` to a variant violates §2.

---

## 9. Context menu

`src/components/context-menu.tsx`. Fully custom — no Radix, no menu library. One
`ContextMenu` root per target card; only one menu can be open at a time
(module-level `activeMenuId`), so opening a second closes the first.

### 8.1 The container

`ContextMenuContent` and `ContextMenuSubContent` share one base:

```
liquid-glass z-50 flex max-h-[min(80vh,400px)] min-w-[8rem]
flex-col gap-y-[2px] overflow-x-hidden overflow-y-auto p-1 text-foreground
```

| Decision | Value | Why |
|---|---|---|
| Layout | `flex flex-col` | The menu is a stack of rows, not free-flowing content |
| Row gap | `gap-y-[2px]` | Exactly 2px between every row — items, labels and separators alike. Spacing belongs to the container, so no item sets its own margin |
| Corner | `rounded-[15px]` | The content pane. Deliberately off-scale: 2px past `rounded-2xl` |
| Padding | `p-1` | 4px inset, so a row's 1px border sits 4px off the pane edge |
| Height | `min(80vh, 400px)` | Caps against the viewport *and* an absolute 400px ceiling |

`ContextMenuSubContent` keeps `rounded-xl` (12px), **not** 15px. The 3px step
down is what makes a nested pane read as inset rather than as a second
top-level menu.

Positioning is clamped to the viewport with `WINDOW_PAD_PX = 25` on every edge,
measured from a ref callback so the clamp runs the moment the node attaches.

### 8.2 Item borders are always on

The single most important rule: **a context menu item's border is never
transparent.** It is part of the resting state, not a hover affordance.

```
border border-secondary/5 hover:border-secondary/8
```

| State | Border | Background |
|---|---|---|
| Rest | `secondary/5` | transparent |
| Hover | `secondary/8` | `secondary/3` |
| Focus | `secondary/5` | `secondary/5` |

Hover is a **brightening step on an existing line**, not the line appearing. The
+3% delta is deliberately small — enough to register as "this row is live",
not enough to look like a state change.

Everything else on the item:

```
relative flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm
cursor-pointer select-none outline-none transition-all duration-500
```

`rounded-[10px]` sits between `rounded-lg` (8px) and `rounded-xl` (12px) so the
row corner follows the pane corner without matching it. `duration-500` is not
local — it is the global base value (§10).

> **Tailwind v4 trap:** the `border` utility is required and cannot be dropped.
> Preflight resets every element to `border: 0 solid`, so `border-secondary/5`
> on its own sets *only* the colour and the width stays 0 — the border silently
> does not render, at rest or on hover. `border border-secondary/5`.

### 8.3 Variants

`variant?: "default" | "destructive" | "primary"`, surfaced to CSS through
`data-variant` on the `<li>`.

| Variant | Rest border | Rest background | Rest text | Hover border | Hover background |
|---|---|---|---|---|---|
| `default` | `secondary/5` | — | foreground | `secondary/8` | `secondary/3` |
| `primary` | `primary/5` | `primary/3` | `primary` | `primary/8` | `primary/5` |
| `destructive` | `secondary/5` | — | `destructive` | `secondary/8` | `destructive/10` (`/20` dark) |

**`primary` is tinted at rest, not on hover.** It carries a persistent
`bg-primary/3` plus `text-primary` while the menu is idle, and its hover step
(`/3` → `/5` background, `/5` → `/8` border) is the same size as the default
variant's. A primary item is therefore the most legible row in a closed menu —
it is the affirmative action, and it should be identifiable before the pointer
arrives.

**`destructive` stays hover-only for its background.** It tints on hover
(`destructive/10`, `/20` in dark) and never at rest; only its text colour is
static. A destructive action that is permanently red reads as a second primary
and competes with it. The asymmetry between the two is intentional.

Currently the post menu's **Delete post** item is the `primary` variant
(`post.tsx`). It was a plain default item before the variant existed.

### 8.4 Rows other than `ContextMenuItem`

`ContextMenuCheckboxItem`, `ContextMenuRadioItem` and `ContextMenuSubTrigger`
still sit one step behind — they carry `border-secondary/3` → `hover:border-secondary/8`
and `rounded-lg` (8px):

| Component | Rest border | Corner |
|---|---|---|
| `ContextMenuItem` | `secondary/5` | `rounded-[10px]` |
| `ContextMenuCheckboxItem` | `secondary/3` | `rounded-lg` |
| `ContextMenuRadioItem` | `secondary/3` | `rounded-lg` |
| `ContextMenuSubTrigger` | `secondary/3` | `rounded-lg` |

This is the live state, not the intent — `ContextMenuItem` was reworked and the
other three were not carried with it. Note also that the checkbox, radio and
sub-trigger rows use `pl-8` to reserve the indicator gutter, whereas
`ContextMenuItem` uses plain `px-2` and gets its indent from `data-[inset]:pl-8`.

---

## 10. General conventions

- Tokens in `:root`; Tailwind mappings in `@theme inline`.
- Prefer a token override over a one-off utility when theming a surface.
- `cn()` (`@/lib/utils`) is the classname helper — it runs `twMerge`.
- Global `duration-500` is applied to every element in `@layer base`; do not
  fight it with a local `duration-*` unless the change is deliberate.

---

## 11. Step transitions and motion

A step change is **opacity plus a small vertical drift** — nothing else. The
vocabulary is shared with SPACE (`dastyare_social_space/docs/DESIGN-SYSTEM.md`),
so the two apps move the same way even where their layouts differ.

| Token | Value |
|---|---|
| Duration | `260ms` |
| Easing | `cubic-bezier(0.23, 1, 0.32, 1)` |
| Drift | `8px` (`translate-y-2`) |
| Reduced motion | opacity only, `150ms` |

The curve is a strong ease-out: most of the distance is covered early and the
last few pixels settle. That is what makes 260ms read as quiet rather than slow.

**Tailwind v4 trap:** `translate-y-*` sets the independent `translate` property,
not `transform`. Name it in the transition list, and never reach for
`transition-all`:

```
transition-[opacity,translate]
```

`transition-all` also sweeps `height` and colours, which turns a two-property
move into a layout animation.

### 11.1 The register form

`src/app/(routes)/os/(routes)/register/page.tsx` reveals the password field
after the email is accepted. The email stays visible, so this is **progressive
disclosure**, not a panel swap — real space has to appear.

`max-height` was the old mechanism and it cannot be right: any value large
enough for the field makes the reveal finish early and then sit still, and any
value close to the field's height clips it mid-fade. The field's height is
measured instead (`passwordFieldRef.scrollHeight`, taken on mount while the
wrapper is still collapsed — the inner field lays out normally inside a
zero-height, `overflow-hidden` wrapper), then animated to that exact value:

```tsx
<div
  inert={!revealed}
  aria-hidden={!revealed}
  style={{ height: revealed ? measuredHeight : 0 }}
  className="overflow-hidden transition-[height] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
>
  <div
    ref={fieldRef}
    className={cn(
      "transition-[opacity,translate] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
      "motion-reduce:translate-y-0 motion-reduce:duration-150",
      revealed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
    )}
  >
    …
  </div>
</div>
```

- `inert` keeps the collapsed field out of the tab order and the accessibility
  tree. Focus is still moved by hand in the existing effect — `inert` removes
  the field from tab order, it does not carry focus.
- The height and the fade run on the same duration and curve, so the field is
  fully opaque exactly as its space finishes opening.
- The `FieldGroup` gap no longer changes with the step. A gap is not animatable,
  so a `gap-y-1.5` → `gap-y-3.5` swap is an instant jump in the middle of a
  smooth move. The wider revealed spacing is `pt-2` inside the measured field
  instead, which opens with the height; the button keeps a constant `mt-2.5`.
- The button label (`continue —` → `login to panel`) is two spans in one grid
  cell, cross-fading on the same curve. The button therefore keeps its size,
  and the inactive label is `aria-hidden` so the accessible name changes
  cleanly.

### 11.2 Reduced motion

Every move ships its fallback in the same class list:

```
motion-reduce:translate-y-0 motion-reduce:duration-150
```

The fade stays — an instant swap is harder to follow than a short fade — but the
drift and the height animation are dropped. Apply `motion-reduce:translate-y-0`
to the leaving state too, not only the entering one, or the field still moves
for reduced-motion users.
