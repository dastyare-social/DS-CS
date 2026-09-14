"use client";

import { useEffect } from "react";

function isImageTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("img, video"));
}

export default function ImageInteractionGuard() {
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (isImageTarget(e.target)) e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      if (isImageTarget(e.target)) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
    };
  }, []);

  return null;
}