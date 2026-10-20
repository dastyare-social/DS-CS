---
name: add-component
description: Add or change a React component in DS-CS without breaking the design system — token architecture, the no-shadow global rule, plain border-radius corners (corner smoothing was tried and removed), liquid-glass usage, cva variants, and the "use client" boundary. Use when adding a UI component, restyling one, or reviewing a component for design-rule violations. Read docs/design-system.md before deviating from these rules.
---

# Adding a component

## Read the two global rules first

These are enforced for the **whole codebase**, not per component. Violating them is the most common way a change gets rejected.

**1. No shadows, anywhere.** No `box-shadow`, no `text-shadow`, no `drop-shadow` filter. Surfaces sit flush with the page and never lift off it. `src/styles/globals.css` declares an *unlayered* reset so a `shadow-*` utility cannot override it — which means a stray `shadow-lg` in a `className` compiles, type-checks, and renders nothing. Remove those classes for clarity even though they are inert; they misdescribe intent.

The single exception is `.liquid-glass`, and only as an **inset** stroke. Inset shadows fade inward and cannot cast outside the element, so the no-depth rule still holds.

**2. Corners are plain `border-radius` — no corner smoothing.** `rounded-*` is stock Tailwind v4 and controls corner *size* only (`rounded-xl` = 12px … `rounded-4xl` = 32px, `rounded-full` = true circle). `corner-shape: superellipse(n)` was tried and removed: it read as a change to corner *size* rather than shape, and radius-compensation scales (×1.21, then ×1.15) visibly oversized every corner, worst on the short full-bleed bars. Do not re-add it globally; if revisited, scope it to specific surfaces. The `@toolwind/corner-shape` package is unusable. Never restate `superellipse()` in a component. See `docs/design-system.md` §3.

## Tokens

Two layers, and the split is the point:

- Raw values live in `:root` in `src/styles/globals.css`.
- `@theme inline` re-exports them under Tailwind's colour namespace so utilities resolve to the live value instead of a build-time copy.

**Add to `:root`.** Add an `@theme inline` mapping only when a Tailwind utility should reach it.

```css
:root {
  --button-background: color-mix(in srgb, var(--primary) 10%, transparent);
}

@theme inline {
  --color-button-background: var(--button-background);
}
```

Never hardcode a raw colour (`#fff`, `oklch(0.65 0.19 41)`) in a component. Severity and hierarchy come from blur, translucency, wash gradients, rim borders and contrast — never from elevation.

## The shape of a component

`src/components/button.tsx` is the reference implementation:

```tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full liquid-glass transition-all disabled:pointer-events-none disabled:opacity-60 outline-none cursor-pointer select-none text-xl md:text-2xl px-5 py-2",
  {
    variants: {
      variant: {
        primary:
          "[--liquid-glass-bg:var(--button-background)] [--liquid-glass-border-color:var(--button-border)] text-button-foreground hover:opacity-60",
        secondary:
          "[--liquid-glass-bg:color-mix(in_srgb,var(--button-background)_20%,transparent)] [--liquid-glass-border-width:2px] [--liquid-glass-border-color:color-mix(in_srgb,var(--button-border)_50%,transparent)] text-button-foreground hover:opacity-60",
      },
    },
    defaultVariants: { variant: "primary" },
  }
);

function Button({
  className,
  variant = "primary",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

The conventions in it:

- Variants live in `cva`, not in `className` strings scattered across call sites.
- Glass is tinted by **overriding tokens** (`[--liquid-glass-bg:...]`), never by restating the effect.
- `data-slot` and `data-variant` are set so tests and Storybook can target elements without relying on classes.
- `cn()` from `@/lib/utils` is `twMerge(clsx(...))` — always use it for class composition.
- `asChild` via Radix `Slot` lets a component render as its child (`<Button asChild><Link/></Button>`). Preserve it when the element is interactive or navigable.

## The client boundary

Components that fetch call the **action layer**, never oRPC directly:

```tsx
"use client";

import { getPosts } from "@/lib/actions/posts";
```

Server-side callers — the OG image route, for instance — import `@/lib/api/*` directly and never touch the RPC client. A relative `/api/rpc` URL has no meaning on the server.

## Liquid glass

`.liquid-glass` is the reusable translucent material for buttons, cards, panels and any surface that should read as glass. It is made of exactly four things, in order: `backdrop-filter: blur() saturate()`, a vertical wash gradient, a translucent background, and a rim from border width + colour.

```tsx
<div className="liquid-glass rounded-2xl px-6 py-4">…</div>
<div className="liquid-glass [--liquid-glass-bg:color-mix(in_srgb,var(--primary)_22%,transparent)]" />
```

The stroke and the border are separate and complementary. `--liquid-glass-border-color` sets edge weight to match the install/update/error bars; the inset stroke adds the luminous rim. Do not merge them.

Glass is invisible on a flat white background. Review it over a busy backdrop using the `Design System/Liquid Glass` Storybook story, not an isolated white canvas.

## Bottom floating bars, and transient errors

The install bar, the update bar and the error bar are **one component** in three places: same `liquid-glass`, same `rounded-2xl px-3 py-2` pill, same `px-4 pt-2.5` wrapper, same `max-w-sm`, same `z-40`. Change the shared look in all three or in none — restyling one breaks the stack into two different bars.

**To report a transient failure, never add a new surface.** Call `raiseError()` from `@/lib/error-bar`; the bar is mounted once in `src/app/(routes)/layout.tsx`, so nothing needs a callback threaded to it.

```tsx
import { raiseError } from "@/lib/error-bar";
try { await createPost({ content }); } catch (err) { raiseError(err); }
```

It is for failures with no better home — rejected writes, dropped calls. It is **not** for form validation, per-attachment upload chips (they carry their own retry), or persistent load/publish error screens. If the user can act on it in place, it stays in place. A new message replaces and restarts a 4s timer; an identical repeat is a no-op, so a flapping error cannot hold the bar open.

**Adding a page with bottom chrome?** Two edits, both next to the existing `--chat-footer-height` write in that page's `updateHeaderFooterOffsets`:

```ts
document.documentElement.style.setProperty(
  "--error-bar-bottom",
  "calc(var(--chat-footer-height) + var(--install-banner-height, 0px) - 5px)"
);
```

...then add `var(--error-bar-height, 0px)` to that page's feed `pb`, scroll safe zone `bottomInset`, and scroll-to-bottom `bottom`. Skip either half and the bar overlaps or floats at the screen edge. Full contract: `docs/design-system.md` §6.

## Tests and stories

Component tests live in `src/components/__tests__/<name>.test.tsx` and use `bun:test`, `@testing-library/react`, and a `happy-dom` window set up per test:

```tsx
import { describe, it, expect, beforeEach } from "bun:test";
import { render } from "@testing-library/react";
import { Button } from "../button";
import React from "react";
import "@testing-library/jest-dom/vitest";
import { Window } from "happy-dom";

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as any;
  globalThis.document = window.document as any;
  globalThis.navigator = window.navigator as any;
  document.body.innerHTML = "";
});

describe("Button Component", () => {
  it("renders with primary variant by default", () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText("Click me")).toHaveAttribute("data-variant", "primary");
  });
});
```

`test-setup.ts` mocks `next/font/local` globally so components can use local fonts under test.

Stories go in `src/components/<name>.stories.tsx` under the `Design System/*` namespace.

## Accessibility

Radix primitives are already a dependency — use them instead of hand-rolling behaviour. Anything that opens a surface is a dialog or a context menu, not a `div` with `onClick`. Every interactive element needs a visible focus state and an accessible name.

## Verify

```bash
bun run test
bun run lint
bun run storybook   # then look at your component against the design-system stories
```

For animations, read the `animate` skill — duration, curve and interruptibility are decisions, not defaults.
