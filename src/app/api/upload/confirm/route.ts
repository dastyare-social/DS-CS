import { NextRequest, NextResponse } from "next/server";
import {
  MediaValidationError,
  requireMediaAuth,
  buildPublicFileUrl,
} from "@/lib/media";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/**
 * Confirm a direct S3 upload and return media metadata
 * @summary Upload Media — Confirm Direct Upload
 * @description After the browser uploads directly to S3 via presigned URL, call this with { key, mimeType, filename, size, width, height, duration } to get the public URL and full media object.
 * @tag Media
 * @contentType application/json
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
    const body = await request.json();
    const { key, mimeType, filename, size, width, height, duration } = body as {
      key?: string;
      mimeType?: string;
      filename?: string;
      size?: number;
      width?: number;
      height?: number;
      duration?: number;
    };

    if (!key || !mimeType) {
      return NextResponse.json(
        { error: "key and mimeType are required" },
        { status: 400 },
      );
    }

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
