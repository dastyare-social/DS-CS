import sharp from "sharp";

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
 * Get dimensions of a video file
 * Note: This is a basic implementation. For production, consider using ffprobe
 */
export async function getVideoDimensions(buffer: Buffer): Promise<MediaDimensions> {
  try {
    // For now, return default values
    // In production, you'd want to use ffprobe or similar to get actual video dimensions
    // This requires installing ffmpeg/ffprobe on the server
    return {
      width: 0,
      height: 0,
      duration: 0,
    };
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
