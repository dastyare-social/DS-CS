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

function getClientDimensions(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve({ width: video.videoWidth, height: video.videoHeight, duration: Math.round(video.duration * 1000) });
      };
      video.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
      video.src = URL.createObjectURL(file);
    } else if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve({ width: img.naturalWidth, height: img.naturalHeight, duration: 0 });
      };
      img.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith("audio/")) {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        // Some codecs report Infinity until first play — treat as unknown
        const d = Number.isFinite(audio.duration) ? audio.duration : 0;
        resolve({ width: 0, height: 0, duration: Math.round(d * 1000) });
      };
      audio.onerror = () => resolve({ width: 0, height: 0, duration: 0 });
      audio.src = URL.createObjectURL(file);
    } else {
      resolve({ width: 0, height: 0, duration: 0 });
    }
  });
}

export const presignedTransport: UploadTransport = (file, onProgress) =>
  new Promise<UploadResult>(async (resolve) => {
    try {
      onProgress(0);

      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({ error: "Presign failed" }));
        resolve({ ok: false, error: err.error || `Presign failed: ${presignRes.status}` });
        return;
      }

      const { uploadUrl, key, kind, mimeType } = await presignRes.json();

      const dims = await getClientDimensions(file);
      // Voice: pass duration only — no size/width/height (the feed player
      // shows stored duration before the audio is downloaded)
      const isAudio = file.type.startsWith("audio/");

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const s3Result = await new Promise<boolean>((res) => {
        xhr.addEventListener("load", () => res(xhr.status >= 200 && xhr.status < 300));
        xhr.addEventListener("error", () => res(false));
        xhr.addEventListener("abort", () => res(false));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", mimeType);
        xhr.send(file);
      });

      if (!s3Result) {
        resolve({ ok: false, error: "S3 upload failed" });
        return;
      }

      onProgress(100);

      const confirmRes = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          mimeType,
          filename: file.name,
          ...(isAudio
            ? { ...(dims.duration ? { duration: dims.duration } : {}) }
            : {
                size: file.size,
                ...(dims.width || dims.height || dims.duration ? dims : {}),
              }),
        }),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({ error: "Confirm failed" }));
        resolve({ ok: false, error: err.error || `Confirm failed: ${confirmRes.status}` });
        return;
      }

      const media = await confirmRes.json();
      resolve({ ok: true, media: media as UploadedMedia });
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
    .map((item) => {
      const m = item.media;
      const hasDimensions = !!(m.width || m.height || m.duration);
      return {
        url: m.url,
        type: mediaKindToPostType(m.kind),
        ...(hasDimensions
          ? {
              dimensions: {
                width: m.width,
                height: m.height,
                duration: m.duration,
              },
            }
          : {}),
      };
    });
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
      setItems((prev) => {
        const next = prev.map((item, i) => (i === index ? updater(item) : item));
        itemsRef.current = next;
        return next;
      });
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

  const retryFile = useCallback(
    (index: number) => {
      const item = itemsRef.current[index];
      if (!item || item.error === null || item.media !== null) return;

      const { file } = item;
      updateItem(index, (it) => ({
        ...it,
        error: null,
        progress: 0,
        media: null,
      }));
      beginUpload();
      void (async () => {
        const result = await transport(file, (percent) =>
          updateItem(index, (it) => ({ ...it, progress: percent }))
        );
        if (result.ok) {
          updateItem(index, (it) => ({
            ...it,
            progress: 100,
            media: result.media,
          }));
        } else {
          updateItem(index, (it) => ({ ...it, error: result.error }));
        }
        endUpload();
      })();
    },
    [beginUpload, endUpload, transport, updateItem]
  );

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
    retryFile,
    clear,
  };
}
