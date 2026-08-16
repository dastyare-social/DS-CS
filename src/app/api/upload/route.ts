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
 * @description Single-file upload convenience endpoint (multipart/form-data with a `file` field). Returns the same metadata as `/api/media` but for one file, with an object response instead of an array. Use the returned `url`, `kind`, `width`, `height`, and `duration` when creating a post or story.
 * @tag Media
 * @contentType multipart/form-data
 * @response MediaUploadResponse
 * @examples response: {"url":"https://cdn.example.com/media/image/abc.jpg","key":"media/image/abc.jpg","kind":"image","mimeType":"image/jpeg","size":12345,"width":1080,"height":1920,"duration":0,"filename":"photo.jpg"}
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
