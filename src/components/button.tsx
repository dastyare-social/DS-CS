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
    defaultVariants: {
      variant: "primary",
    },
  },
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
