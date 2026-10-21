"use client";

import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/lib/utils";

/**
 * The shadcn resizable, on `react-resizable-panels`.
 *
 * The separator is the handle: the hairline is one pixel wide and the
 * `after` pseudo-element widens the grab area to eight, so the whole strip
 * drags. The hairline does not change colour on hover or while dragging —
 * a divider that reacts to the pointer reads as a control rather than an edge.
 */
function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      className={cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

function ResizablePanel({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return (
    <ResizablePrimitive.Panel className={cn(className)} {...props} />
  );
}

function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator>) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        "relative flex w-px shrink-0 items-center justify-center bg-secondary/20 outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2",
        className,
      )}
      {...props}
    />
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
