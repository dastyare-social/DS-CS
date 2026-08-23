import { NextRequest, NextResponse } from "next/server";
import {
  MediaValidationError,
  requireMediaAuth,
  presignUpload,
} from "@/lib/media";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/**
 * Generate a presigned S3 PUT URL for direct browser-to-S3 upload
 * @summary Upload Media — Presign URL
 * @description Returns a presigned URL the browser can PUT to directly, giving real upload progress. Send { filename, mimeType } in the JSON body.
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
    const { filename, mimeType } = body as {
      filename?: string;
      mimeType?: string;
    };

    if (!filename || !mimeType) {
      return NextResponse.json(
        { error: "filename and mimeType are required" },
        { status: 400 },
      );
    }

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
