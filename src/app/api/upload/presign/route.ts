import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  MediaValidationError,
  requireMediaAuth,
  presignUpload,
} from "@/lib/media";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/** @id PresignBody */
export const PresignBody = z.object({
  filename: z.string().describe("Original file name, used for the extension"),
  mimeType: z
    .string()
    .describe("MIME type of the file, e.g. video/mp4 or image/jpeg"),
});

/** @id PresignResultSchema */
export const PresignResultSchema = z.object({
  uploadUrl: z.string().describe("Presigned S3 PUT URL — valid for 1 hour"),
  key: z.string().describe("S3 object key — pass to /api/upload/confirm"),
  kind: z.enum(["image", "video", "audio", "file"]),
  mimeType: z.string(),
});

/**
 * Generate a presigned S3 PUT URL for direct browser-to-S3 upload
 * @summary Upload Media — Presign URL
 * @description Returns a presigned URL the browser can PUT to directly, giving real upload progress via xhr.upload.progress. Step 1 of the direct upload flow: call this, PUT the file to `uploadUrl`, then call `/api/upload/confirm` with the returned `key`.
 * @tag Media
 * @body PresignBody
 * @response PresignResultSchema
 * @examples request: {"filename": "story.mp4", "mimeType": "video/mp4"}
 * @examples response: {"uploadUrl": "https://ktbjawdgcckqqcslfwed.storage.supabase.co/storage/v1/s3/dastyare-social-cs/media/video/0931725d-aedb-4e27-aac6-aae46f3a2872.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&...", "key": "media/video/0931725d-aedb-4e27-aac6-aae46f3a2872.mp4", "kind": "video", "mimeType": "video/mp4"}
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
    const parseResult = PresignBody.safeParse(jsonBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "filename and mimeType are required" },
        { status: 400 },
      );
    }

    const { filename, mimeType } = parseResult.data;
    const fakeFile = new File([new Uint8Array(0)], filename, { type: mimeType });
    const result = await presignUpload(fakeFile);

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("POST /api/upload/presign error", err);
    if (err instanceof MediaValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
