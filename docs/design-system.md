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
| `--liquid-glass-blur` | `16px` | refraction radius |
| `--liquid-glass-saturate` | `180%` | vibrancy behind the glass |
| `--liquid-glass-bg` | `white` @ 55% | base tint |
| `--liquid-glass-wash-top` | `white` @ 65% | gradient top |
| `--liquid-glass-wash-bottom` | `white` @ 15% | gradient bottom |
| `--liquid-glass-border-width` | `1px` | rim thickness |
| `--liquid-glass-border-color` | `white` @ 60% | rim colour |
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
| `--liquid-glass-stroke-opacity` | `45%` |

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

## 5. Button

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