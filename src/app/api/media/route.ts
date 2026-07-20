import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKeyAuth } from "@/lib/auth/api-key";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { getMediaDimensions } from "@/lib/utils/media";

export const dynamic = "force-dynamic";

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

const BUCKET = process.env.S3_BUCKET_NAME!;

function joinUrl(base: string, ...parts: string[]): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const cleanedParts = parts.map((p) => p.replace(/^\/+/, ""));
  return [trimmedBase, ...cleanedParts].join("/");
}

function buildPublicFileUrl(key: string): string {
  if (process.env.S3_PUBLIC_BASE_URL && process.env.S3_PUBLIC_BASE_URL.trim().length) {
    return joinUrl(process.env.S3_PUBLIC_BASE_URL, key);
  }

  const endpoint = process.env.S3_ENDPOINT || "";
  if (!endpoint) {
    throw new Error("S3_PUBLIC_BASE_URL or S3_ENDPOINT must be set");
  }

  if (endpoint.includes(".storage.supabase.co")) {
    const publicUrl = endpoint
      .replace(".storage.supabase.co", ".supabase.co")
      .replace("/storage/v1/s3", "/storage/v1/object/public");
    return joinUrl(publicUrl, BUCKET, key);
  }

  return joinUrl(endpoint, BUCKET, key);
}

/** @id MediaUploadResponse */
export const MediaUploadResponse = z.object({
  url: z.string(),
  key: z.string(),
  width: z.number(),
  height: z.number(),
  duration: z.number().optional(),
  mimeType: z.string(),
  size: z.number(),
});

/**
 * Upload media to S3
 * @description Uploads media files (images, videos) to S3 storage with automatic dimension detection. Accepts multipart/form-data with files[] array. Returns array of uploaded media objects with URLs and dimensions.
 * @tag Media
 * @contentType multipart/form-data
 * @response MediaUploadResponse[]
 * @openapi
 */
export async function POST(req: NextRequest) {
  const authResponse = requireApiKeyAuth(req);
  if (authResponse) {
    return authResponse;
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("files");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        continue;
      }

      const mimeType = file.type || "application/octet-stream";
      const ext = mimeType.split("/")[1] || "bin";
      const key = `media/${randomUUID()}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      // Get dimensions
      const dimensions = await getMediaDimensions(buffer, mimeType);

      const publicUrl = buildPublicFileUrl(key);

      results.push({
        url: publicUrl,
        key,
        width: dimensions.width,
        height: dimensions.height,
        duration: dimensions.duration,
        mimeType,
        size: file.size,
      });
    }

    return NextResponse.json(results, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/media error", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal Server Error" },
      { status: 500 }
    );
  }
}
