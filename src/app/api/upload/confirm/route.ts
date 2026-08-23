import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  MediaValidationError,
  requireMediaAuth,
  buildPublicFileUrl,
} from "@/lib/media";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/** @id ConfirmBody */
export const ConfirmBody = z.object({
  key: z.string().describe("S3 object key returned by /api/upload/presign"),
  mimeType: z.string().describe("MIME type of the uploaded file"),
  filename: z.string().optional().describe("Original file name"),
  size: z.number().optional().describe("File size in bytes (from client)"),
  width: z
    .number()
    .optional()
    .describe("Media width in px — read on the client before upload"),
  height: z
    .number()
    .optional()
    .describe("Media height in px — read on the client before upload"),
  duration: z
    .number()
    .optional()
    .describe("Video duration in ms — read on the client before upload"),
});

/** @id ConfirmResultSchema */
export const ConfirmResultSchema = z.object({
  url: z.string().describe("Public URL of the uploaded media"),
  key: z.string(),
  kind: z.enum(["image", "video", "audio", "file"]),
  mimeType: z.string(),
  size: z.number(),
  width: z.number(),
  height: z.number(),
  duration: z.number(),
  filename: z.string(),
});

/**
 * Confirm a direct S3 upload and return media metadata
 * @summary Upload Media — Confirm Direct Upload
 * @description Step 2 of the direct upload flow: after the browser PUTs the file to the presigned URL, call this with the `key` plus client-side metadata. Returns the public URL and full media object ready for post/story creation.
 * @tag Media
 * @body ConfirmBody
 * @response ConfirmResultSchema
 * @examples request: {"key": "media/video/7c9e6679-7425-40de-944b-e07fc1f90ae7.mp4", "mimeType": "video/mp4", "filename": "story.mp4", "size": 6041570, "width": 1080, "height": 1920, "duration": 35533}
 * @examples response: {"url": "https://sample-ref-12345678.supabase.co/storage/v1/object/public/dastyare-social-cs/media/video/7c9e6679-7425-40de-944b-e07fc1f90ae7.mp4", "key": "media/video/7c9e6679-7425-40de-944b-e07fc1f90ae7.mp4", "kind": "video", "mimeType": "video/mp4", "size": 6041570, "width": 1080, "height": 1920, "duration": 35533, "filename": "story.mp4"}
 * @openapi
 */
export async function POST(request: NextRequest) {
  const authError = await requireMediaAuth(request);
  if (authError) return authError;

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Read-only demo mode is active" },
      { status: 403 },
    );
  }

  try {
    const jsonBody = await request.json().catch(() => null);
    const parseResult = ConfirmBody.safeParse(jsonBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "key and mimeType are required" },
        { status: 400 },
      );
    }

    const { key, mimeType, filename, size, width, height, duration } =
      parseResult.data;

    const kind = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType.startsWith("audio/")
          ? "audio"
          : "file";

    return NextResponse.json(
      {
        url: buildPublicFileUrl(key),
        key,
        kind,
        mimeType,
        size: size || 0,
        width: width || 0,
        height: height || 0,
        duration: duration || 0,
        filename: filename || key.split("/").pop() || key,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("POST /api/upload/confirm error", err);
    if (err instanceof MediaValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
