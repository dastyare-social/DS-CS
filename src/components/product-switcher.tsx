"use client";

import { cn } from "@/lib/utils";

/**
 * The product switcher: DS, CS and WEB.
 *
 * Three Dastyare products share a look, and the switcher is how you move
 * between them. CS is this app, so it is the active segment and not a link.
 * The other two go wherever the deployment points them — set
 * `NEXT_PUBLIC_DS_URL` and `NEXT_PUBLIC_WEB_URL`; an unset one renders as a
 * plain label rather than a dead link.
 *
 * The treatment is the one the design file uses: a segmented control in a
 * rounded container, the active segment on white with a stronger border, the
 * others on the brand tint.
 */

const PRODUCTS = [
  {
    id: "ds",
    label: "DS",
    href: process.env.NEXT_PUBLIC_DS_URL?.trim() || undefined,
  },
  {
    id: "cs",
    label: "CS",
    href: undefined,
  },
  {
    id: "web",
    label: "WEB",
    href: process.env.NEXT_PUBLIC_WEB_URL?.trim() || undefined,
  },
] as const;

export default function ProductSwitcher({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-x-1 rounded-full border border-secondary/5 bg-primary/[2%] p-1",
        className,
      )}
    >
      {PRODUCTS.map((product) => {
        const isCurrent = product.href === undefined && product.id === "cs";

        const classes = cn(
          "flex flex-1 items-center justify-center rounded-full px-2 text-center text-lg leading-6 tracking-tighter transition-colors duration-150 motion-reduce:transition-none",
          isCurrent
            ? "border-2 border-primary/10 bg-white text-primary"
            : "[--liquid-glass-bg:var(--button-background)] [--liquid-glass-border-color:var(--button-border)] border border-primary/5 bg-primary/5 text-primary hover:opacity-60",
        );

        if (!product.href) {
          return (
            <span
              key={product.id}
              aria-current={isCurrent ? "page" : undefined}
              className={classes}
            >
              {product.label}
            </span>
          );
        }

        return (
          <a
            key={product.id}
            href={product.href}
            rel="noreferrer"
            className={classes}
          >
            {product.label}
          </a>
        );
      })}
    </div>
  );
}
