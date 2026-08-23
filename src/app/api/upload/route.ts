import { NextRequest, NextResponse } from "next/server";
import {
  MediaValidationError,
  requireMediaAuth,
  uploadFileToS3,
} from "@/lib/media";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/**
 * Upload a single media file
 * @summary Upload Media — Single File
 * @description Single-file upload endpoint (multipart/form-data with a `file` field). Server-side upload — buffers the file then uploads to S3. Returns media metadata. For real upload progress, use `/api/upload/presign` + `/api/upload/confirm` (direct browser-to-S3) instead.
 * @tag Media
 * @contentType multipart/form-data
 * @response MediaUploadResponse
 * @examples response: {"url":"https://sample-ref-12345678.supabase.co/storage/v1/object/public/dastyare-social-cs/media/image/9f8e7d6c-5b4a-4321-8765-fedcba987654.jpg","key":"media/image/9f8e7d6c-5b4a-4321-8765-fedcba987654.jpg","kind":"image","mimeType":"image/jpeg","size":1234567,"width":1080,"height":1920,"duration":0,"filename":"photo.jpg"}
 * @openapi
 */
export async function POST(request: NextRequest) {
  const authError = await requireMediaAuth(request);
  if (authError) return authError;

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Read-only demo mode is active" },
      { status: 403 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided (field name: file)" },
        { status: 400 }
      );
    }

    const uploaded = await uploadFileToS3(file);

    return NextResponse.json(uploaded, { status: 200 });
  } catch (err: unknown) {
    console.error("POST /api/upload error", err);
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
