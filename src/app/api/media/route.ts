import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  MediaValidationError,
  requireMediaAuth,
  uploadFilesToS3,
} from "@/lib/media";

export const dynamic = "force-dynamic";

/** @id MediaUploadResponse */
export const MediaUploadResponse = z.object({
  url: z.string(),
  key: z.string(),
  kind: z.enum(["image", "video", "audio", "file"]),
  mimeType: z.string(),
  size: z.number(),
  width: z.number(),
  height: z.number(),
  duration: z.number().optional(),
  filename: z.string(),
});

/**
 * Upload media files
 * @description Uploads one or more media files to S3-compatible storage. Accepts multipart/form-data with a `files[]` field. Each file is validated against the configured size limits and MIME allowlist, then uploaded under a `media/<kind>/` key prefix. Returns an array of media objects. Use the returned `url`, `kind`, `width`, `height`, and `duration` when creating a post or story.
 * @tag Media
 * @contentType multipart/form-data
 * @response MediaUploadResponse[]
 * @examples response: [{"url":"https://cdn.example.com/media/image/abc.jpg","key":"media/image/abc.jpg","kind":"image","mimeType":"image/jpeg","size":12345,"width":1080,"height":1920,"duration":0,"filename":"photo.jpg"}]
 * @openapi
 */
export async function POST(req: NextRequest) {
  const authError = await requireMediaAuth(req);
  if (authError) return authError;

  try {
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided (field name: files[])" },
        { status: 400 }
      );
    }

    const results = await uploadFilesToS3(files);

    return NextResponse.json(results, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/media error", err);
    if (err instanceof MediaValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
