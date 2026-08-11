import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    });
  }
  return client;
}

export const S3_BUCKET = () => process.env.S3_BUCKET_NAME || "";

export function joinUrl(base: string, ...parts: string[]): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const cleanedParts = parts.map((p) => p.replace(/^\/+/, ""));
  return [trimmedBase, ...cleanedParts].join("/");
}

export function buildPublicFileUrl(key: string): string {
  if (
    process.env.S3_PUBLIC_BASE_URL &&
    process.env.S3_PUBLIC_BASE_URL.trim().length
  ) {
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
    return joinUrl(publicUrl, S3_BUCKET(), key);
  }

  return joinUrl(endpoint, S3_BUCKET(), key);
}
