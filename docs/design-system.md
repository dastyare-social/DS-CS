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
the utility that consumes them, in §4 and §5.

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
sets edge weight to match the install/update banners
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

## 3. Corner smoothing — 60%, global rule

**Every rounded surface in this app uses 60% corner smoothing. This is not a
per-component preference; it is enforced for the whole codebase.**

```css
corner-shape: superellipse(0.6);
```

That is the CSS spelling of a **60% corner smoothing** — the continuous
"squircle" corner that Figma and iOS use. `superellipse(0.6)` re-shapes the
corners *inside* the existing `border-radius`, so `rounded-*` still controls the
corner **size** while this controls the corner **shape**.

It is declared once, in the base layer of `src/styles/globals.css`, against
every element:

```css
:where(*):not(.rounded-full):not(.w-full) {
  corner-shape: var(--corner-smoothing);
}
```

`--corner-smoothing: superellipse(0.6)` in `:root` is the single source of
truth. **Never restate `superellipse()` in a component** — override the token
if a surface genuinely needs a different curve, and say why.

### Rules

- **Cards, panels and dialogs get 60% smoothing** — anything `rounded-*` that
  holds content: `rounded-lg` through `rounded-3xl`, or a raw `border-radius`.
- **True circles stay circles.** `.rounded-full` is excluded. A 50% radius means
  "circle", and smoothing it would square off every avatar, pill and round
  button (54 call sites). If you add another circle, use `rounded-full` so the
  exclusion keeps working.
- **Full-bleed bars keep circular corners.** `.w-full` is excluded — the install
  and update banners, and the pinned-posts bar. Their radius is proportionally
  huge next to their short height (a 16px radius on a 48px-tall bar is a third
  of its height), and a superellipse there reads as an **angular wedge** rather
  than a smooth curve. This was a real regression when the rule was applied to
  every element; don't reintroduce it.
- **`:where()` keeps specificity at 0**, so any single utility can override the
  shape without `!important`.

If you build a new short, wide, full-width bar, it already inherits the correct
behaviour — do nothing.

### Browser support

`corner-shape` is **experimental and Chromium-only** at time of writing. Where
it is unsupported the declaration is dropped and plain `border-radius` corners
render — a graceful downgrade, never a broken layout. Do not add a JS or
polyfill workaround for it.

> **Terminology note:** "iOS smoothing" also refers to the liquid-glass *inset
> stroke* (§2.1), which is a blurred rim, not a corner curve. They are unrelated
> mechanisms that share a name. This section is about corner **shape**; §2.1 is
> about edge **softness**.

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
| `--liquid-glass-border-color` | `--secondary` @ 5% | rim colour — a dark hairline, not a white rim (this app is light-only, so a white rim is invisible); matches `border-secondary/5`, the rim the install/update banners use |
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

### 4.5 Do not pass `backdrop-blur-*` alongside the utility

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
of the install/update banner at the bottom:

```tsx
topInset="calc(var(--chat-header-height) + var(--pinned-bar-height, 0px) / 2)"
bottomInset="calc(var(--chat-footer-height) + var(--install-banner-height, 0px) / 2)"
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

## 6. Button

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

## 6. General conventions

- Tokens in `:root`; Tailwind mappings in `@theme inline`.
- Prefer a token override over a one-off utility when theming a surface.
- `cn()` (`@/lib/utils`) is the classname helper — it runs `twMerge`.
- Global `duration-500` is applied to every element in `@layer base`; do not
  fight it with a local `duration-*` unless the change is deliberate.