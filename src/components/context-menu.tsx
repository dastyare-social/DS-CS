"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CursorPosition = { x: number; y: number };

type ContextMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  cursorPosition: CursorPosition | null;
  setCursorPosition: (pos: CursorPosition | null) => void;
};

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null
);

function useContextMenuContext() {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("ContextMenu components must be used within <ContextMenu>");
  }
  return ctx;
}

// Root
interface ContextMenuProps {
  children: React.ReactNode;
}

/**
 * Root provider — wraps trigger & content.
 */
export function ContextMenu({ children }: ContextMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [cursorPosition, setCursorPosition] =
    React.useState<CursorPosition | null>(null);

  // Close on Esc
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const value = React.useMemo(
    () => ({ open, setOpen, cursorPosition, setCursorPosition }),
    [open, cursorPosition]
  );

  return (
    <ContextMenuContext.Provider value={value}>
      {children}
    </ContextMenuContext.Provider>
  );
}

// Trigger
interface ContextMenuTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
}

/**
 * Wrap any element you want to right-click on.
 * Opens menu at the cursor position.
 */
export const ContextMenuTrigger = React.forwardRef<
  HTMLElement,
  ContextMenuTriggerProps
>(function ContextMenuTrigger(
  { asChild, children, onContextMenu, onTouchStart, onTouchEnd, ...props },
  ref
) {
  const { setOpen, setCursorPosition } = useContextMenuContext();
  const touchTimeoutRef = React.useRef<number | null>(null);
  const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const openAt = (x: number, y: number) => {
    setOpen(false);
    setCursorPosition({ x, y });
    // slight delay to ensure state updates sequentially on mobile
    setTimeout(() => {
      setOpen(true);
    }, 0);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    openAt(event.clientX, event.clientY);

    onContextMenu?.(event);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (touchTimeoutRef.current !== null) {
      window.clearTimeout(touchTimeoutRef.current);
    }

    touchTimeoutRef.current = window.setTimeout(() => {
      const pos = touchStartPosRef.current;
      if (!pos) return;
      openAt(pos.x, pos.y);
    }, 500);

    onTouchStart?.(event);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchTimeoutRef.current !== null) {
      window.clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
    touchStartPosRef.current = null;

    onTouchEnd?.(event);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any, any>, {
      ref,
      onContextMenu: handleContextMenu,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      ...props,
    });
  }

  return (
    <div
      ref={ref as any}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...props}
    >
      {children}
    </div>
  );
});

// Portal-ish wrapper — simple implementation using React portal
import { createPortal } from "react-dom";

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setContainer(document.body);
    setMounted(true);
  }, []);

  if (!mounted || !container) return null;

  return createPortal(children, container);
}

interface ContextMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional: close when clicking inside */
  closeOnSelect?: boolean;
}

/**
 * The floating content, positioned at cursor.
 */
export const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  ContextMenuContentProps
>(function ContextMenuContent(
  { className, style, closeOnSelect = false, ...props },
  ref
) {
  const { open, setOpen, cursorPosition } = useContextMenuContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  // merge refs
  React.useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref(contentRef.current);
    } else {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current =
        contentRef.current;
    }
  }, [ref]);

  // Close when clicking outside
  React.useEffect(() => {
    if (!open) return;

    const handleClick = (event: MouseEvent) => {
      if (!contentRef.current) return;
      if (!contentRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleScroll = () => setOpen(false);
    const handleResize = () => setOpen(false);

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, setOpen]);

  if (!open || !cursorPosition) return null;

  const { x, y } = cursorPosition;

  return (
    <Portal>
      <div
        ref={contentRef}
        style={{
          position: "fixed",
          left: x,
          top: y,
          transformOrigin: "top left",
          // You can clamp to viewport here if you want collision handling
          ...style,
        }}
        className={cn(
          // same style as your Radix version
          "backdrop-blur-3xl z-50 max-h-[min(80vh,400px)] min-w-[8rem] transition-all duration-500 overflow-x-hidden overflow-y-auto rounded-xl border border-secondary/5 bg-background/80 p-1 text-foreground",
          // animations — using tw-animate-css / tailwind animate utils
          "animate-in fade-in-0 zoom-in-95",
          className
        )}
        {...props}
      />
    </Portal>
  );
});

// Item
interface ContextMenuItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

/**
 * Single clickable item
 */
export const ContextMenuItem = React.forwardRef<
  HTMLLIElement,
  ContextMenuItemProps
>(function ContextMenuItem(
  { className, inset, variant = "default", onClick, ...props },
  ref
) {
  const { setOpen } = useContextMenuContext();

  const handleClick: React.MouseEventHandler<HTMLLIElement> = (e) => {
    onClick?.(e);
    // auto-close by default when clicking an item
    setOpen(false);
  };

  return (
    <li
      ref={ref}
      data-inset={inset}
      data-variant={variant}
      onClick={handleClick}
      className={cn(
        "focus:bg-secondary/5 border border-transparent hover:bg-secondary/3 hover:border-secondary/3 transition-all duration-500",
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none",
        "data-[variant=destructive]:text-destructive",
        "data-[variant=destructive]:hover:bg-destructive/10 dark:data-[variant=destructive]:hover:bg-destructive/20",
        className
      )}
      {...props}
    />
  );
});

// Label
interface ContextMenuLabelProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
}

export const ContextMenuLabel = React.forwardRef<
  HTMLLIElement,
  ContextMenuLabelProps
>(function ContextMenuLabel({ className, inset, ...props }, ref) {
  return (
    <li
      ref={ref}
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        "data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  );
});

// Separator
interface ContextMenuSeparatorProps extends React.LiHTMLAttributes<HTMLHRElement> {}

export const ContextMenuSeparator = React.forwardRef<
  HTMLHRElement,
  ContextMenuSeparatorProps
>(function ContextMenuSeparator({ className, ...props }, ref) {
  return (
    <hr
      ref={ref}
      className={cn("mx-1 my-1 h-px bg-border/60 border-0", className)}
      {...props}
    />
  );
});

// Checkbox Item
interface ContextMenuCheckboxItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const ContextMenuCheckboxItem = React.forwardRef<
  HTMLLIElement,
  ContextMenuCheckboxItemProps
>(function ContextMenuCheckboxItem(
  { className, children, checked = false, onCheckedChange, ...props },
  ref
) {
  const { setOpen } = useContextMenuContext();

  const handleClick: React.MouseEventHandler<HTMLLIElement> = (e) => {
    e.stopPropagation();
    onCheckedChange?.(!checked);
    setOpen(false);
  };

  return (
    <li
      ref={ref}
      onClick={handleClick}
      className={cn(
        "focus:bg-secondary/5 border border-transparent hover:bg-secondary/3 hover:border-secondary/3",
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        {checked && (
          <svg
            className="h-4 w-4 text-foreground"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <polyline
              points="20 6 9 17 4 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {children}
    </li>
  );
});

// Radio group & item
interface ContextMenuRadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

const RadioGroupContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

export function ContextMenuRadioGroup({
  value,
  onValueChange,
  children,
}: ContextMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      {children}
    </RadioGroupContext.Provider>
  );
}

interface ContextMenuRadioItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  value: string;
}

export const ContextMenuRadioItem = React.forwardRef<
  HTMLLIElement,
  ContextMenuRadioItemProps
>(function ContextMenuRadioItem({ className, children, value, ...props }, ref) {
  const radioCtx = React.useContext(RadioGroupContext);
  const { setOpen } = useContextMenuContext();

  if (!radioCtx) {
    throw new Error(
      "ContextMenuRadioItem must be used within ContextMenuRadioGroup"
    );
  }

  const selected = radioCtx.value === value;

  const handleClick: React.MouseEventHandler<HTMLLIElement> = (e) => {
    e.stopPropagation();
    radioCtx.onValueChange(value);
    setOpen(false);
  };

  return (
    <li
      ref={ref}
      onClick={handleClick}
      className={cn(
        "focus:bg-secondary/5 border border-transparent hover:bg-secondary/3 hover:border-secondary/3",
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pl-8 pr-2 text-sm outline-none",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        {selected && (
          <svg
            className="h-2.5 w-2.5 text-foreground"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="6" fill="currentColor" />
          </svg>
        )}
      </span>
      {children}
    </li>
  );
});

// Submenu
interface ContextMenuSubContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ContextMenuSubContext =
  React.createContext<ContextMenuSubContextValue | null>(null);

export function ContextMenuSub({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  const value = React.useMemo(() => ({ open, setOpen }), [open]);

  return (
    <ContextMenuSubContext.Provider value={value}>
      {children}
    </ContextMenuSubContext.Provider>
  );
}

interface ContextMenuSubTriggerProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
}

export const ContextMenuSubTrigger = React.forwardRef<
  HTMLLIElement,
  ContextMenuSubTriggerProps
>(function ContextMenuSubTrigger(
  { className, inset, children, ...props },
  ref
) {
  const subCtx = React.useContext(ContextMenuSubContext);
  if (!subCtx) {
    throw new Error("ContextMenuSubTrigger must be used within ContextMenuSub");
  }

  const handleMouseEnter = () => subCtx.setOpen(true);
  const handleMouseLeave = () => subCtx.setOpen(false);

  return (
    <li
      ref={ref}
      data-inset={inset}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "focus:bg-secondary/5 border border-transparent hover:bg-secondary/3 hover:border-secondary/3",
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none",
        "data-[inset]:pl-8",
        className
      )}
      {...props}
    >
      {children}
      <span className="ml-auto flex h-3 w-3 items-center justify-center">
        <svg
          className="h-3 w-3 text-muted-foreground"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polyline
            points="9 6 15 12 9 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </li>
  );
});

interface ContextMenuSubContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const ContextMenuSubContent = React.forwardRef<
  HTMLDivElement,
  ContextMenuSubContentProps
>(function ContextMenuSubContent({ className, style, ...props }, ref) {
  const subCtx = React.useContext(ContextMenuSubContext);
  const parentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref(parentRef.current);
    } else {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current =
        parentRef.current;
    }
  }, [ref]);

  if (!subCtx) {
    throw new Error("ContextMenuSubContent must be used within ContextMenuSub");
  }

  if (!subCtx.open) return null;

  // Very simple submenu positioning: appear to the right
  return (
    <div
      ref={parentRef}
      style={{
        position: "absolute",
        top: 0,
        left: "100%",
        transformOrigin: "top left",
        ...style,
      }}
      className={cn(
        "backdrop-blur-3xl z-50 max-h-[min(80vh,400px)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-xl border border-secondary/5 bg-background/80 p-1 text-foreground",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    />
  );
});
