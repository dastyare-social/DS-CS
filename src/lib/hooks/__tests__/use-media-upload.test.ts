import { describe, it, expect, beforeEach } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { Window } from "happy-dom";
import {
  MAX_ATTACHMENTS,
  buildMediaInputs,
  inferPostType,
  mediaKindToPostType,
  useMediaUpload,
} from "../use-media-upload";
import type {
  MediaUploadItem,
  UploadedMedia,
  UploadResult,
  UploadTransport,
} from "../use-media-upload";

beforeEach(() => {
  const window = new Window();
  globalThis.window = window as unknown as Window;
  globalThis.document = window.document as unknown as Document;
  globalThis.navigator = window.navigator as unknown as Navigator;
  document.body.innerHTML = "";
});

const makeFile = (name: string, type = "image/jpeg") =>
  new File(["hello"], name, { type });

const makeMedia = (over: Partial<UploadedMedia> = {}): UploadedMedia => ({
  url: "https://cdn.example.com/media/image/x.jpg",
  key: "media/image/x.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  size: 10,
  width: 640,
  height: 480,
  duration: 0,
  filename: "x.jpg",
  ...over,
});

const uploadResponse = (over: Partial<UploadedMedia> = {}) =>
  JSON.stringify(makeMedia(over));

type Handler = (event: unknown) => void;

class MockXHR {
  static instances: MockXHR[] = [];
  upload: { addEventListener: (type: string, cb: Handler) => void };
  private handlers: Record<string, Handler> = {};
  private uploadHandlers: Record<string, Handler> = {};
  openMethod = "";
  openUrl = "";
  sentFormData: FormData | null = null;
  status = 200;
  responseText = "{}";

  constructor() {
    MockXHR.instances.push(this);
    this.upload = {
      addEventListener: (type, cb) => {
        this.uploadHandlers[type] = cb;
      },
    };
  }

  addEventListener(type: string, cb: Handler) {
    this.handlers[type] = cb;
  }

  open(method: string, url: string) {
    this.openMethod = method;
    this.openUrl = url;
  }

  send(formData: FormData) {
    this.sentFormData = formData;
  }

  fire(type: string, event: Record<string, unknown> = {}) {
    const cb = this.handlers[type] || this.uploadHandlers[type];
    cb?.({ ...event, type });
  }
}

describe("useMediaUpload — real path via mocked XMLHttpRequest", () => {
  beforeEach(() => {
    MockXHR.instances = [];
    globalThis.XMLHttpRequest =
      MockXHR as unknown as typeof XMLHttpRequest;
  });

  it("selecting a file starts an upload to /api/upload with the file", () => {
    const { result } = renderHook(() => useMediaUpload());

    act(() => {
      result.current.selectFiles([makeFile("photo.jpg")]);
    });

    const xhr = MockXHR.instances[0];
    expect(xhr).toBeDefined();
    expect(xhr.openMethod).toBe("POST");
    expect(xhr.openUrl).toBe("/api/upload");
    expect(xhr.sentFormData?.get("file")).toEqual(makeFile("photo.jpg"));
    expect(result.current.isUploading).toBe(true);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].progress).toBe(0);
    expect(result.current.items[0].error).toBeNull();
    expect(result.current.items[0].media).toBeNull();
  });

  it("reports upload progress while the file is uploading", () => {
    const { result } = renderHook(() => useMediaUpload());

    act(() => {
      result.current.selectFiles([makeFile("photo.jpg")]);
    });

    const xhr = MockXHR.instances[0];
    act(() => {
      xhr.fire("progress", { lengthComputable: true, loaded: 512, total: 1024 });
    });

    expect(result.current.items[0].progress).toBe(50);
    expect(result.current.completedMedia).toHaveLength(0);
  });

  it("stores the uploaded URL + metadata on a successful upload", async () => {
    const { result } = renderHook(() => useMediaUpload());

    act(() => {
      result.current.selectFiles([makeFile("photo.jpg")]);
    });

    const xhr = MockXHR.instances[0];
    xhr.status = 200;
    xhr.responseText = uploadResponse({
      url: "https://cdn.example.com/media/image/photo.jpg",
      kind: "image",
      width: 1080,
      height: 1920,
    });

    await act(async () => {
      xhr.fire("load");
    });

    expect(result.current.items[0].progress).toBe(100);
    expect(result.current.items[0].error).toBeNull();
    expect(result.current.completedMedia.map((m) => m.url)).toEqual([
      "https://cdn.example.com/media/image/photo.jpg",
    ]);
    expect(result.current.items[0].media?.width).toBe(1080);
    expect(result.current.items[0].media?.height).toBe(1920);
    expect(result.current.isUploading).toBe(false);
  });

  it("records an error on a non-200 response and does not expose a URL", async () => {
    const { result } = renderHook(() => useMediaUpload());

    act(() => {
      result.current.selectFiles([makeFile("photo.jpg")]);
    });

    const xhr = MockXHR.instances[0];
    xhr.status = 413;
    xhr.responseText = "{}";

    await act(async () => {
      xhr.fire("load");
    });

    expect(result.current.items[0].error).toBe("Upload failed: 413");
    expect(result.current.items[0].media).toBeNull();
    expect(result.current.completedMedia).toHaveLength(0);
    expect(result.current.hasError).toBe(true);
    expect(result.current.isUploading).toBe(false);
  });

  it("records a network error when the request fails", async () => {
    const { result } = renderHook(() => useMediaUpload());

    act(() => {
      result.current.selectFiles([makeFile("photo.jpg")]);
    });

    const xhr = MockXHR.instances[0];
    await act(async () => {
      xhr.fire("error");
    });

    expect(result.current.items[0].error).toBe("Network error");
    expect(result.current.completedMedia).toHaveLength(0);
  });
});

describe("useMediaUpload — injected transport", () => {
  it("updates progress and stores media for each uploaded file", async () => {
    const transport: UploadTransport = async (file, onProgress) => {
      onProgress(60);
      return { ok: true, media: makeMedia({ url: `https://cdn/${file.name}` }) };
    };

    const { result } = renderHook(() => useMediaUpload(transport));

    await act(async () => {
      result.current.selectFiles([makeFile("a.jpg"), makeFile("b.jpg")]);
    });

    expect(result.current.items[0].progress).toBe(100);
    expect(result.current.items[1].progress).toBe(100);
    expect(result.current.completedMedia.map((m) => m.url)).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
    ]);
    expect(result.current.isUploading).toBe(false);
  });

  it("surfaces a mid-flight progress state before the upload resolves", async () => {
    let resolveUpload!: (r: UploadResult) => void;
    const transport: UploadTransport = (file, onProgress) => {
      onProgress(33);
      return new Promise((res) => {
        resolveUpload = res;
      });
    };

    const { result } = renderHook(() => useMediaUpload(transport));

    act(() => {
      result.current.selectFiles([makeFile("a.jpg")]);
    });

    expect(result.current.items[0].progress).toBe(33);
    expect(result.current.isUploading).toBe(true);

    await act(async () => {
      resolveUpload({ ok: true, media: makeMedia() });
    });

    expect(result.current.items[0].progress).toBe(100);
    expect(result.current.completedMedia).toHaveLength(1);
    expect(result.current.isUploading).toBe(false);
  });

  it("keeps failed uploads out of completedMedia and marks hasError", async () => {
    const transport: UploadTransport = async () => ({ ok: false, error: "Network error" });

    const { result } = renderHook(() => useMediaUpload(transport));

    await act(async () => {
      result.current.selectFiles([makeFile("a.jpg")]);
    });

    expect(result.current.items[0].error).toBe("Network error");
    expect(result.current.items[0].media).toBeNull();
    expect(result.current.completedMedia).toHaveLength(0);
    expect(result.current.hasError).toBe(true);
    expect(result.current.isUploading).toBe(false);
  });

  it("caps the selection at MAX_ATTACHMENTS", async () => {
    const transport: UploadTransport = async (file) => ({
      ok: true,
      media: makeMedia({ url: `https://cdn/${file.name}` }),
    });

    const { result } = renderHook(() => useMediaUpload(transport));
    const many = Array.from({ length: 12 }, (_, i) =>
      makeFile(`f${i}.jpg`)
    );

    await act(async () => {
      result.current.selectFiles(many);
    });

    expect(result.current.items).toHaveLength(MAX_ATTACHMENTS);
    expect(result.current.completedMedia).toHaveLength(MAX_ATTACHMENTS);
  });

  it("removes a file and clears all state", async () => {
    const transport: UploadTransport = async (file) => ({
      ok: true,
      media: makeMedia({ url: `https://cdn/${file.name}` }),
    });

    const { result } = renderHook(() => useMediaUpload(transport));

    await act(async () => {
      result.current.selectFiles([makeFile("a.jpg"), makeFile("b.jpg")]);
    });
    expect(result.current.items).toHaveLength(2);

    act(() => {
      result.current.removeFile(0);
    });
    expect(result.current.items.map((i) => i.file.name)).toEqual(["b.jpg"]);
    expect(result.current.completedMedia.map((m) => m.url)).toEqual([
      "https://cdn/b.jpg",
    ]);

    act(() => {
      result.current.clear();
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.completedMedia).toHaveLength(0);
    expect(result.current.isUploading).toBe(false);
  });
});

describe("media helpers", () => {
  it("maps media kind to post type", () => {
    expect(mediaKindToPostType("image")).toBe("image");
    expect(mediaKindToPostType("video")).toBe("video");
    expect(mediaKindToPostType("audio")).toBe("voice");
    expect(mediaKindToPostType("file")).toBe("file");
  });

  it("builds media inputs with url, type and dimensions, skipping failed uploads", () => {
    const items: MediaUploadItem[] = [
      {
        file: makeFile("a.jpg"),
        progress: 100,
        error: null,
        media: makeMedia({
          url: "https://cdn/a.jpg",
          kind: "image",
          width: 640,
          height: 480,
        }),
      },
      {
        file: makeFile("broken.jpg"),
        progress: 0,
        error: "Network error",
        media: null,
      },
      {
        file: makeFile("b.mp3"),
        progress: 100,
        error: null,
        media: makeMedia({
          url: "https://cdn/b.mp3",
          kind: "audio",
          width: 0,
          height: 0,
          duration: 12,
        }),
      },
    ];

    expect(buildMediaInputs(items)).toEqual([
      {
        url: "https://cdn/a.jpg",
        type: "image",
        dimensions: { width: 640, height: 480, duration: 0 },
      },
      {
        url: "https://cdn/b.mp3",
        type: "voice",
        dimensions: { width: 0, height: 0, duration: 12 },
      },
    ]);
  });

  it("returns an empty array when nothing was uploaded", () => {
    expect(buildMediaInputs([])).toEqual([]);
    expect(
      buildMediaInputs([
        {
          file: makeFile("a.jpg"),
          progress: 0,
          error: null,
          media: null,
        },
      ])
    ).toEqual([]);
  });

  it("infers the post type from the first successfully uploaded media", () => {
    expect(inferPostType([])).toBe("text");
    expect(
      inferPostType([
        {
          file: makeFile("a.jpg"),
          progress: 0,
          error: null,
          media: null,
        },
      ])
    ).toBe("text");
    expect(
      inferPostType([
        {
          file: makeFile("a.jpg"),
          progress: 100,
          error: null,
          media: makeMedia({ kind: "video" }),
        },
      ])
    ).toBe("video");
  });
});
