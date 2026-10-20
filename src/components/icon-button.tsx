"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/* The chrome shared by every round icon control in the app.

   The rounded corner lives in TWO places on purpose, and this is the reason
   this component exists rather than repeating the class string at call sites:

   - the outer control is `rounded-full`, so the border and the hover/focus
     surface trace the circle;
   - the inner icon slot is also `rounded-full`, so an icon that carries its
     own fill or background traces the same circle instead of a square one
     poking out of it.

   The composer previously had only the second, which is why its attach icon
   looked square-cornered inside a round control. */
const controlClasses =
  "flex justify-center items-center rounded-full border border-secondary/3 " +
  "opacity-80 transition-opacity hover:opacity-100 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const iconClasses = "flex items-center justify-center rounded-full size-full";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only control needs an accessible name. */
  label: string;
  /** The icon element. Wrapped in a rounded-full slot automatically. */
  children: ReactNode;
  /** Match the composer controls (10). `sm` is for denser rows. */
  size?: "sm" | "md";
  /** Vertical offset used by the composer row. */
  className?: string;
}

export function IconButton({
  label,
  children,
  size = "md",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        controlClasses,
        size === "md" ? "size-10 p-2" : "size-8 p-1.5",
        className,
      )}
      {...props}
    >
      <span className={iconClasses}>{children}</span>
    </button>
  );
}

interface IconFileButtonProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Required: an icon-only control needs an accessible name. */
  label: string;
  /** The icon element. Wrapped in a rounded-full slot automatically. */
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/**
 * The same control, wired to a hidden file input.
 *
 * A `<label>` rather than a `<button>`: clicking a button nested in a label
 * does not reliably activate the input, and a `<label>` also keeps the native
 * "click anywhere, or focus and press Enter" behaviour that a button gives for
 * free. `disabled` is passed through to the input so the browser blocks the
 * picker on its own, with the guard on `onChange` as a backstop for a picker
 * that was already open when the connection dropped.
 */
export function IconFileButton({
  label,
  children,
  size = "md",
  className,
  disabled,
  ...props
}: IconFileButtonProps) {
  return (
    <label
      title={label}
      className={cn(
        controlClasses,
        "cursor-pointer",
        size === "md" ? "size-10 p-2" : "size-8 p-1.5",
        disabled && "cursor-not-allowed",
        className,
      )}
    >
      <input
        type="file"
        className="hidden"
        disabled={disabled}
        aria-label={label}
        {...props}
      />
      <span className={iconClasses}>{children}</span>
    </label>
  );
}

export default IconButton;