export type MediaKind = "image" | "video" | "audio" | "file";

const DEFAULT_MAX_SIZE_MB: Record<MediaKind, number> = {
  image: 10,
  video: 100,
  audio: 25,
  file: 25,
};

const DEFAULT_ALLOWED_MIME_TYPES: Record<MediaKind, string[]> = {
  image: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/svg+xml",
  ],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: [
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    "audio/aac",
    "audio/flac",
  ],
  file: ["application/pdf", "text/plain"],
};

export class MediaValidationError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "MediaValidationError";
  }
}

function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function getEnvMaxSize(kind: MediaKind): number {
  const map: Record<MediaKind, string> = {
    image: "MEDIA_MAX_IMAGE_SIZE_MB",
    video: "MEDIA_MAX_VIDEO_SIZE_MB",
    audio: "MEDIA_MAX_AUDIO_SIZE_MB",
    file: "MEDIA_MAX_FILE_SIZE_MB",
  };
  return mbToBytes(numEnv(map[kind], DEFAULT_MAX_SIZE_MB[kind]));
}

function getAllowedMimeTypes(): Set<string> {
  const override = (process.env.MEDIA_ALLOWED_MIME_TYPES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (override.length > 0) return new Set(override);

  const defaults = new Set<string>();
  for (const list of Object.values(DEFAULT_ALLOWED_MIME_TYPES)) {
    for (const mime of list) defaults.add(mime);
  }
  return defaults;
}

export const mediaConfig = () => ({
  maxSizeBytes: {
    image: getEnvMaxSize("image"),
    video: getEnvMaxSize("video"),
    audio: getEnvMaxSize("audio"),
    file: getEnvMaxSize("file"),
  },
  allowedMimeTypes: getAllowedMimeTypes(),
  keyPrefix: (process.env.MEDIA_KEY_PREFIX || "media").replace(/^\/+|\/+$/g, ""),
});

export function classifyMediaType(mime: string | null): MediaKind {
  if (!mime) return "file";
  const normalized = mime.toLowerCase().split(";")[0].trim();
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  return "file";
}

export function maxSizeForMime(mime: string): number {
  return getEnvMaxSize(classifyMediaType(mime));
}

export function isMimeAllowed(mime: string): boolean {
  return mediaConfig().allowedMimeTypes.has(mime.toLowerCase().split(";")[0].trim());
}

export function validateFile(file: File): MediaKind {
  const mimeType = (file.type || "application/octet-stream").toLowerCase();

  if (!isMimeAllowed(mimeType)) {
    throw new MediaValidationError(
      400,
      `File type "${mimeType}" is not allowed`
    );
  }

  const maxBytes = maxSizeForMime(mimeType);
  if (file.size > maxBytes) {
    throw new MediaValidationError(
      400,
      `File exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB size limit`
    );
  }

  return classifyMediaType(mimeType);
}
