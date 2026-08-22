"use client";

import { useCallback, useRef, useState } from "react";

export type MediaKind = "image" | "video" | "audio" | "file";

export type UploadedMedia = {
  url: string;
  key: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  duration?: number;
  filename: string;
};

export type PostType = "text" | "image" | "video" | "voice" | "file";

export type MediaUploadItem = {
  file: File;
  progress: number;
  error: string | null;
  media: UploadedMedia | null;
};

export type UploadResult =
  | { ok: true; media: UploadedMedia }
  | { ok: false; error: string };

export type UploadTransport = (
  file: File,
  onProgress: (percent: number) => void
) => Promise<UploadResult>;

export const MAX_ATTACHMENTS = 10;

const defaultTransport: UploadTransport = (file, onProgress) =>
  new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try {
          const media = JSON.parse(xhr.responseText) as UploadedMedia;
          onProgress(100);
          resolve({ ok: true, media });
        } catch {
          resolve({ ok: false, error: "Failed to parse response" });
        }
      } else {
        resolve({ ok: false, error: `Upload failed: ${xhr.status}` });
      }
    });

    xhr.addEventListener("error", () => {
      resolve({ ok: false, error: "Network error" });
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });

export const streamingTransport: UploadTransport = (file, onProgress) =>
  new Promise<UploadResult>(async (resolve) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-stream", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        resolve({ ok: false, error: `Upload failed: ${response.status}` });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        resolve({ ok: false, error: "No response stream" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (eventType === "progress") {
                onProgress(parsed.percent);
              } else if (eventType === "done") {
                onProgress(100);
                resolve({ ok: true, media: parsed as UploadedMedia });
                return;
              } else if (eventType === "error") {
                resolve({ ok: false, error: parsed.error });
                return;
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      }

      resolve({ ok: false, error: "Stream ended unexpectedly" });
    } catch {
      resolve({ ok: false, error: "Network error" });
    }
  });

export function mediaKindToPostType(kind: MediaKind): PostType {
  switch (kind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "voice";
    case "file":
      return "file";
  }
}

export type MediaInput = {
  url: string;
  type: PostType;
  dimensions?: { width: number; height: number; duration?: number };
};

export function buildMediaInputs(items: MediaUploadItem[]): MediaInput[] {
  return items
    .filter(
      (item): item is MediaUploadItem & { media: UploadedMedia } =>
        item.media !== null
    )
    .map((item) => ({
      url: item.media.url,
      type: mediaKindToPostType(item.media.kind),
      dimensions: {
        width: item.media.width,
        height: item.media.height,
        duration: item.media.duration,
      },
    }));
}

export function inferPostType(items: MediaUploadItem[]): PostType {
  const first = items.find((item) => item.media !== null);
  if (!first?.media) return "text";
  return mediaKindToPostType(first.media.kind);
}

export function useMediaUpload(transport: UploadTransport = defaultTransport) {
  const [items, setItems] = useState<MediaUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const itemsRef = useRef<MediaUploadItem[]>([]);
  const inflight = useRef(0);

  const updateItem = useCallback(
    (index: number, updater: (item: MediaUploadItem) => MediaUploadItem) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? updater(item) : item))
      );
    },
    []
  );

  const beginUpload = useCallback(() => {
    inflight.current += 1;
    setIsUploading(true);
  }, []);

  const endUpload = useCallback(() => {
    inflight.current -= 1;
    if (inflight.current <= 0) {
      inflight.current = 0;
      setIsUploading(false);
    }
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], startIndex: number) => {
      if (files.length === 0) return;
      beginUpload();
      await Promise.all(
        files.map(async (file, index) => {
          const actualIndex = startIndex + index;
          const result = await transport(file, (percent) =>
            updateItem(actualIndex, (item) => ({ ...item, progress: percent }))
          );
          if (result.ok) {
            updateItem(actualIndex, (item) => ({
              ...item,
              progress: 100,
              media: result.media,
            }));
          } else {
            updateItem(actualIndex, (item) => ({
              ...item,
              error: result.error,
            }));
          }
        })
      );
      endUpload();
    },
    [beginUpload, endUpload, transport, updateItem]
  );

  const selectFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const startIndex = itemsRef.current.length;
      const newItems: MediaUploadItem[] = files.map((file) => ({
        file,
        progress: 0,
        error: null,
        media: null,
      }));
      setItems((prev) => {
        const combined = [...prev, ...newItems].slice(0, MAX_ATTACHMENTS);
        itemsRef.current = combined;
        return combined;
      });
      void uploadFiles(files, startIndex);
    },
    [uploadFiles]
  );

  const removeFile = useCallback((index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    itemsRef.current = [];
  }, []);

  const completedMedia = items
    .filter(
      (item): item is MediaUploadItem & { media: UploadedMedia } =>
        item.media !== null
    )
    .map((item) => item.media);

  const hasError = items.some((item) => item.error !== null);

  return {
    items,
    isUploading,
    completedMedia,
    hasError,
    selectFiles,
    removeFile,
    clear,
  };
}
