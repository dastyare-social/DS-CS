import { describe, it, expect, afterEach } from "bun:test";
import {
  classifyMediaType,
  MediaValidationError,
  validateFile,
} from "../config";
import { buildPublicFileUrl } from "../s3";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("media config", () => {
  describe("classifyMediaType", () => {
    it("should classify image MIME types", () => {
      expect(classifyMediaType("image/png")).toBe("image");
      expect(classifyMediaType("image/jpeg")).toBe("image");
      expect(classifyMediaType("image/svg+xml")).toBe("image");
    });

    it("should classify video MIME types", () => {
      expect(classifyMediaType("video/mp4")).toBe("video");
      expect(classifyMediaType("video/webm")).toBe("video");
    });

    it("should classify audio MIME types", () => {
      expect(classifyMediaType("audio/mpeg")).toBe("audio");
      expect(classifyMediaType("audio/wav")).toBe("audio");
    });

    it("should default unknown MIME types to file", () => {
      expect(classifyMediaType("application/pdf")).toBe("file");
      expect(classifyMediaType("text/plain")).toBe("file");
      expect(classifyMediaType(null)).toBe("file");
      expect(classifyMediaType("")).toBe("file");
    });

    it("should ignore parameters and be case-insensitive", () => {
      expect(classifyMediaType("IMAGE/JPEG; charset=utf-8")).toBe("image");
      expect(classifyMediaType("Video/MP4 ")).toBe("video");
    });
  });

  describe("validateFile", () => {
    it("should accept allowed image files", () => {
      const file = new File([new Blob(["data"])], "a.png", {
        type: "image/png",
      });
      expect(validateFile(file)).toBe("image");
    });

    it("should accept allowed video files", () => {
      const file = new File([new Blob(["data"])], "a.mp4", {
        type: "video/mp4",
      });
      expect(validateFile(file)).toBe("video");
    });

    it("should reject MIME types outside the allowlist", () => {
      const file = new File([new Blob(["data"])], "a.exe", {
        type: "application/x-msdownload",
      });
      expect(() => validateFile(file)).toThrow(MediaValidationError);
    });

    it("should reject files over the configured size limit", () => {
      process.env.MEDIA_MAX_IMAGE_SIZE_MB = "0.001"; // ~1KB
      const bigFile = new File([new Uint8Array(2048)], "a.png", {
        type: "image/png",
      });
      expect(() => validateFile(bigFile)).toThrow(MediaValidationError);
    });

    it("should apply per-kind size limits", () => {
      process.env.MEDIA_MAX_VIDEO_SIZE_MB = "0.001"; // ~1KB
      const bigFile = new File([new Uint8Array(2048)], "a.mp4", {
        type: "video/mp4",
      });
      expect(() => validateFile(bigFile)).toThrow(MediaValidationError);

      const smallImage = new File([new Uint8Array(512)], "a.png", {
        type: "image/png",
      });
      expect(validateFile(smallImage)).toBe("image");
    });
  });
});

describe("media s3", () => {
  describe("buildPublicFileUrl", () => {
    it("should use S3_PUBLIC_BASE_URL when set", () => {
      process.env.S3_PUBLIC_BASE_URL = "https://cdn.example.com/";
      expect(buildPublicFileUrl("media/image/a.jpg")).toBe(
        "https://cdn.example.com/media/image/a.jpg"
      );
    });

    it("should convert Supabase storage endpoints to public URLs", () => {
      process.env.S3_PUBLIC_BASE_URL = "";
      process.env.S3_ENDPOINT =
        "https://abc123.storage.supabase.co/storage/v1/s3";
      process.env.S3_BUCKET_NAME = "dastyare";
      expect(buildPublicFileUrl("media/video/b.mp4")).toBe(
        "https://abc123.supabase.co/storage/v1/object/public/dastyare/media/video/b.mp4"
      );
    });

    it("should join endpoint, bucket, and key for other providers", () => {
      process.env.S3_PUBLIC_BASE_URL = "";
      process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com/";
      process.env.S3_BUCKET_NAME = "dastyare";
      expect(buildPublicFileUrl("media/image/c.png")).toBe(
        "https://s3.us-east-1.amazonaws.com/dastyare/media/image/c.png"
      );
    });
  });
});
