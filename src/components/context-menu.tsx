"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CursorPosition = { x: number; y: number };

/** Final rendered bounds of the menu after viewport clamping. */
type MenuRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

// Minimum padding between any floating menu part and the window edges.
const WINDOW_PAD_PX = 25;

type ContextMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  cursorPosition: CursorPosition | null;
  setCursorPosition: (pos: CursorPosition | null) => void;
  menuRect: MenuRect | null;
  setMenuRect: React.Dispatch<React.SetStateAction<MenuRect | null>>;
};

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null,
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

// Only one context menu may be open on screen at a time. Each post mounts its
// own <ContextMenu> root with private state, so a module-level store closes any
// previously-open menu the moment a different trigger opens one.
const menuListeners = new Set<() => void>();
let activeMenuId: string | null = null;

function subscribeActiveMenu(listener: () => void) {
  menuListeners.add(listener);
  return () => {
    menuListeners.delete(listener);
  };
}

function getActiveMenuId() {
  return activeMenuId;
}

function openMenu(id: string) {
  if (activeMenuId === id) return;
  activeMenuId = id;
  menuListeners.forEach((listener) => listener());
}

function closeMenu(id: string) {
  if (activeMenuId !== id) return;
  activeMenuId = null;
  menuListeners.forEach((listener) => listener());
}

/**
 * Root provider — wraps trigger & content.
 */
export function ContextMenu({ children }: ContextMenuProps) {
  const menuId = React.useId();
  const activeMenuId = React.useSyncExternalStore(
    subscribeActiveMenu,
    getActiveMenuId,
    getActiveMenuId,
  );
  const open = activeMenuId === menuId;
  const [cursorPosition, setCursorPosition] =
    React.useState<CursorPosition | null>(null);
  const [menuRect, setMenuRect] = React.useState<MenuRect | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next) openMenu(menuId);
      else closeMenu(menuId);
    },
    [menuId],
  );

  // Close on Esc
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      cursorPosition,
      setCursorPosition,
      menuRect,
      setMenuRect,
    }),
    [open, cursorPosition, menuRect, setOpen],
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
  ref,
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
    return React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      {
        ref,
        onContextMenu: handleContextMenu,
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
        ...props,
      },
    );
  }

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
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
  ref,
) {
  const { open, setOpen, cursorPosition, setMenuRect } =
    useContextMenuContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [adjustedPos, setAdjustedPos] =
    React.useState<CursorPosition | null>(null);

  // Clamp to viewport so menu never overflows the browser window.
  // The Portal mounts its element via useEffect, so the DOM node does not
  // exist yet when this component's own effect runs. Measuring from a ref
  // callback is deterministic: it fires synchronously the moment the node
  // attaches (every open and every remount), so clamping always applies.
  // offsetWidth/offsetHeight are used (not the transformed rect) so the
  // zoom-in animation never under-measures the final size.
  const clampNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const cp = cursorPosition;
      if (!cp) return;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      let x = cp.x;
      let y = cp.y;

      if (x + width > window.innerWidth - WINDOW_PAD_PX)
        x = window.innerWidth - width - WINDOW_PAD_PX;
      if (x < WINDOW_PAD_PX) x = WINDOW_PAD_PX;
      if (y + height > window.innerHeight - WINDOW_PAD_PX)
        y = window.innerHeight - height - WINDOW_PAD_PX;
      if (y < WINDOW_PAD_PX) y = WINDOW_PAD_PX;

      if (x !== cp.x || y !== cp.y) setAdjustedPos({ x, y });

      // Share the menu's real placement so the emoji bar can align to it.
      setMenuRect((prev) =>
        prev &&
        prev.left === x &&
        prev.top === y &&
        prev.width === width &&
        prev.height === height
          ? prev
          : { left: x, top: y, width, height },
      );
    },
    [cursorPosition, setMenuRect],
  );

  const setContentRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      clampNode(node);
    },
    [clampNode],
  );

  React.useLayoutEffect(() => {
    if (!open || !cursorPosition) {
      setAdjustedPos(null);
      setMenuRect(null);
      return;
    }
    // Safety net: if the node is already mounted here, re-apply the clamp.
    clampNode(contentRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursorPosition]);

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
      const target = event.target as Node;
      if (contentRef.current.contains(target)) {
        return;
      }
      // ignore clicks on sibling floating parts (e.g. the emoji strip)
      if (
        target instanceof Element &&
        target.closest("[data-context-menu-floating]")
      ) {
        return;
      }
      setOpen(false);
    };

    const handleScroll = (event: Event) => {
      // scrolling inside a floating part (e.g. the emoji strip) keeps the
      // menu open — only page scrolls dismiss it
      if (
        event.target instanceof Element &&
        event.target.closest("[data-context-menu-floating]")
      ) {
        return;
      }
      setOpen(false);
    };
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

  const { x, y } = adjustedPos ?? cursorPosition;

  return (
    <Portal>
      <div
        ref={setContentRef}
        style={{
          position: "fixed",
          left: x,
          top: y,
          transformOrigin: "top left",
          ...style,
        }}
        className={cn(
          // same style as your Radix version
          "backdrop-blur-3xl z-50 max-h-[min(80vh,400px)] min-w-[8rem] transition-[opacity,transform] duration-500 overflow-x-hidden overflow-y-auto rounded-xl border border-secondary/5 bg-background/80 p-1 text-foreground",
          // animations — using tw-animate-css / tailwind animate utils
          "animate-in fade-in-0 zoom-in-95",
          className,
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
  ref,
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
        className,
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
        "px-2 py-1.5 text-xs text-muted-foreground",
        "data-[inset]:pl-8",
        className,
      )}
      {...props}
    />
  );
});

// Separator
type ContextMenuSeparatorProps = React.LiHTMLAttributes<HTMLHRElement>;

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
interface ContextMenuCheckboxItemProps
  extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const ContextMenuCheckboxItem = React.forwardRef<
  HTMLLIElement,
  ContextMenuCheckboxItemProps
>(function ContextMenuCheckboxItem(
  { className, children, checked = false, onCheckedChange, ...props },
  ref,
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
        className,
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

interface ContextMenuRadioItemProps
  extends React.LiHTMLAttributes<HTMLLIElement> {
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
      "ContextMenuRadioItem must be used within ContextMenuRadioGroup",
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
        className,
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

interface ContextMenuSubTriggerProps
  extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
}

export const ContextMenuSubTrigger = React.forwardRef<
  HTMLLIElement,
  ContextMenuSubTriggerProps
>(function ContextMenuSubTrigger(
  { className, inset, children, ...props },
  ref,
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
        className,
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

type ContextMenuSubContentProps = React.HTMLAttributes<HTMLDivElement>;

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
        className,
      )}
      {...props}
    />
  );
});

// Quick-reaction emoji strip — a fully rounded floating part rendered on TOP
// of the menu content (25px gap). Horizontally scrollable, same glassy style.
const MENU_GAP_PX = 8;
interface ContextMenuEmojiBarProps {
  emojis?: readonly string[];
  onSelect: (emoji: string) => void;
  /** width of the menu content this bar floats above (default: w-36 = 144px) */
  menuWidth?: number;
  className?: string;
}

export function ContextMenuEmojiBar({
  emojis,
  onSelect,
  menuWidth = 144,
  className,
}: ContextMenuEmojiBarProps) {
  const { open, cursorPosition, setOpen, menuRect } =
    useContextMenuContext();
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{
    left: number;
    top: number;
    placeBelow: boolean;
  } | null>(null);

  // Align the bar to the menu: start-aligned by default, flipped to the menu's
  // end when it would overflow the right edge — with a 25px minimum padding
  // from every window edge. Prefers floating above the menu (normal MENU_GAP_PX
  // gap) and flips below it when that would clip the top edge.
  // Uses a ref callback so the measure fires the moment the node attaches —
  // no rAF retry needed even though the bar renders inside its own Portal.
  const clampBar = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const cp = cursorPosition;
      if (!cp) return;
      const m = menuRect;
      const iw = window.innerWidth;
      const ih = window.innerHeight;
      const barHeight = node.offsetHeight;
      const menuW = m ? m.width : menuWidth;
      const barWidth = Math.round(menuW * 1.25);

      const menuTop = m ? m.top : Math.max(WINDOW_PAD_PX, cp.y);
      const menuBottom = m ? m.top + m.height : menuTop;
      const menuLeft = m ? m.left : Math.max(WINDOW_PAD_PX, cp.x);
      const menuRight = m ? m.left + m.width : menuLeft + menuW;

      const placeBelow = menuTop - MENU_GAP_PX - barHeight < WINDOW_PAD_PX;

      // Horizontal: start-aligned to the menu; flip to the end when it would
      // overflow the right padding.
      let left = menuLeft;
      if (left + barWidth > iw - WINDOW_PAD_PX) {
        left = menuRight - barWidth;
        if (left < WINDOW_PAD_PX) left = WINDOW_PAD_PX;
      }
      if (left < WINDOW_PAD_PX) left = WINDOW_PAD_PX;

      let top: number;
      if (placeBelow) {
        top = menuBottom + MENU_GAP_PX;
        if (top + barHeight > ih - WINDOW_PAD_PX)
          top = ih - barHeight - WINDOW_PAD_PX;
      } else {
        top = menuTop - MENU_GAP_PX;
      }

      setPosition((prev) =>
        prev &&
        prev.left === left &&
        prev.top === top &&
        prev.placeBelow === placeBelow
          ? prev
          : { left, top, placeBelow },
      );
    },
    [cursorPosition, menuRect, menuWidth],
  );

  const setBarRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      barRef.current = node;
      clampBar(node);
    },
    [clampBar],
  );

  React.useLayoutEffect(() => {
    if (!open || !cursorPosition) {
      setPosition(null);
      return;
    }
    clampBar(barRef.current);
  }, [open, cursorPosition, menuRect, menuWidth, clampBar]);

  if (!open || !cursorPosition || !emojis?.length) return null;

  const barWidth = Math.round((menuRect ? menuRect.width : menuWidth) * 1.25);
  const room = position ?? {
    left: Math.max(WINDOW_PAD_PX, cursorPosition.x),
    top: cursorPosition.y - MENU_GAP_PX,
    placeBelow: false,
  };

  return (
    <Portal>
      <div
        ref={setBarRef}
        data-context-menu-floating=""
        style={{
          position: "fixed",
          left: room.left,
          top: room.top,
          width: barWidth,
          transform: room.placeBelow ? "none" : "translateY(-100%)",
        }}
        className={cn(
          "z-50 rounded-full border border-secondary/5 bg-background/80 backdrop-blur-3xl px-1 pt-2.5 pb-2 text-foreground",
          "flex items-center overflow-x-auto none-scroll-bar select-none",
          "animate-in fade-in-0 zoom-in-95 duration-500 transition-[opacity,transform]",
          className,
        )}
      >
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(emoji);
              setOpen(false);
            }}
            className="shrink-0 px-1.5 text-lg leading-none outline-none cursor-pointer origin-bottom transition-transform duration-150 hover:scale-125 active:scale-95"
          >
            {emoji}
          </button>
        ))}
      </div>
    </Portal>
  );
}
