import sharp from "sharp";
import probe from "ffmpeg-probe";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

export interface MediaDimensions {
  width: number;
  height: number;
  duration?: number;
}

/**
 * Get dimensions of an image file
 */
export async function getImageDimensions(buffer: Buffer): Promise<MediaDimensions> {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return { width: 0, height: 0 };
  }
}

/**
 * Get dimensions of a video file using ffprobe
 */
export async function getVideoDimensions(buffer: Buffer): Promise<MediaDimensions> {
  try {
    // Write buffer to temporary file for ffprobe to read
    const tempFilePath = join(tmpdir(), `temp-video-${Date.now()}.mp4`);
    await writeFile(tempFilePath, buffer);

    try {
      const metadata = await probe(tempFilePath);
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        duration: metadata.duration ? Math.round(metadata.duration * 1000) : 0, // Convert to milliseconds
      };
    } finally {
      // Clean up temp file
      await unlink(tempFilePath).catch(() => {});
    }
  } catch (error) {
    console.error("Error getting video dimensions:", error);
    return { width: 0, height: 0, duration: 0 };
  }
}

/**
 * Get dimensions based on MIME type
 */
export async function getMediaDimensions(
  buffer: Buffer,
  mimeType: string
): Promise<MediaDimensions> {
  if (mimeType.startsWith("image/")) {
    return getImageDimensions(buffer);
  }
  if (mimeType.startsWith("video/")) {
    return getVideoDimensions(buffer);
  }
  return { width: 0, height: 0 };
}
